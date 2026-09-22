from django.apps import AppConfig


class MeditationConfig(AppConfig):
    name = "meditation"

    def ready(self):
        from django.contrib import admin

        admin.site.site_header = "Shunyata admin"
        admin.site.site_title = "Shunyata admin"
        admin.site.index_title = "Shunyata admin"
