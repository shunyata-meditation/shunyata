from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from meditation.models import MeditationSession, MeditationType, PracticeGoal
from meditation.serializers import (
    MeditationSessionSerializer,
    MeditationTypeSerializer,
    PracticeGoalSerializer,
)


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


class PracticeGoalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        goal = PracticeGoal.objects.filter(user=request.user).first()
        return Response(
            {"weekly_minutes": goal.weekly_minutes if goal is not None else None}
        )

    def put(self, request):
        serializer = PracticeGoalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        goal, _ = PracticeGoal.objects.update_or_create(
            user=request.user,
            defaults=serializer.validated_data,
        )
        return Response(PracticeGoalSerializer(goal).data)

    def delete(self, request):
        PracticeGoal.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
