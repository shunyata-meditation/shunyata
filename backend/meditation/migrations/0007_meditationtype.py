from typing import ClassVar

import django.db.models.deletion
from django.db import migrations, models

DEFAULT_TYPES = {
    "mindfulness": "Mindfulness",
    "breathing": "Breathing",
    "body_scan": "Body Scan",
    "loving_kindness": "Loving Kindness",
    "walking": "Walking",
    "other": "Other",
}


def migrate_types(apps, schema_editor):
    MeditationSession = apps.get_model("meditation", "MeditationSession")
    MeditationType = apps.get_model("meditation", "MeditationType")

    names = dict(DEFAULT_TYPES)
    for value in (
        MeditationSession.objects.values_list("meditation_type", flat=True)
        .distinct()
        .iterator()
    ):
        names.setdefault(value, value.replace("_", " ").title())

    type_ids = {
        value: MeditationType.objects.get_or_create(name=name)[0].pk
        for value, name in names.items()
    }
    for value, type_id in type_ids.items():
        MeditationSession.objects.filter(meditation_type=value).update(
            meditation_type_record_id=type_id
        )


class Migration(migrations.Migration):
    dependencies: ClassVar[list[tuple[str, str]]] = [("meditation", "0006_emailverificationtoken")]

    operations: ClassVar[list[migrations.operations.base.Operation]] = [
        migrations.CreateModel(
            name="MeditationType",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=100, unique=True)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.AddField(
            model_name="meditationsession",
            name="meditation_type_record",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="meditation.meditationtype",
            ),
        ),
        migrations.RunPython(migrate_types, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="meditationsession",
            name="meditation_type",
        ),
        migrations.RenameField(
            model_name="meditationsession",
            old_name="meditation_type_record",
            new_name="meditation_type",
        ),
        migrations.AlterField(
            model_name="meditationsession",
            name="meditation_type",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="sessions",
                to="meditation.meditationtype",
            ),
        ),
    ]
