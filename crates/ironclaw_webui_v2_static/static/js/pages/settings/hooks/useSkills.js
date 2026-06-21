import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSkills,
  installSkill as installSkillRequest,
  removeSkill as removeSkillRequest
} from '../lib/settings-api.js';

export function useSkills() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills
  });

  const installMutation = useMutation({
    mutationFn: installSkillRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    }
  });

  const removeMutation = useMutation({
    mutationFn: removeSkillRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    }
  });

  const skills = query.data?.skills || [];
  // Wired to the v2 skills endpoints (`fetchSkills` -> `{ skills, count }`).
  // "No fake readiness": the import form goes live ONLY on a successful, non-todo
  // fetch. A loading/errored fetch (backend unreachable) or a defensive
  // `{ todo: true }` fallback stays 'todo' (gated), so the form never renders
  // over an unproven backend where a submit would silently fail.
  const status = query.isSuccess && !query.data?.todo ? 'ready' : 'todo';

  return {
    skills,
    query,
    status,
    installSkill: installMutation.mutateAsync,
    removeSkill: removeMutation.mutateAsync,
    isInstalling: installMutation.isPending,
    isRemoving: removeMutation.isPending
  };
}
