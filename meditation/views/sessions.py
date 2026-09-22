from rest_framework import permissions, viewsets

from meditation.models import MeditationSession, MeditationType
from meditation.serializers import MeditationSessionSerializer, MeditationTypeSerializer


class MeditationTypeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MeditationType.objects.all()
    serializer_class = MeditationTypeSerializer
    permission_classes = [permissions.IsAuthenticated]


class MeditationSessionViewSet(viewsets.ModelViewSet):
    serializer_class = MeditationSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):  # type: ignore[return-value]
        return MeditationSession.objects.filter(user=self.request.user).select_related(
            "meditation_type"
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
