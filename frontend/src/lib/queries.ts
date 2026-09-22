import { queryOptions } from '@tanstack/react-query'
import {
  getPracticeGoal,
  getSession,
  listSessions,
  listTypes,
} from '../server/functions'
import { unwrap } from './contracts'

export const sessionsQuery = () =>
  queryOptions({
    queryKey: ['sessions'],
    queryFn: async () => unwrap(await listSessions()),
    staleTime: 30_000,
  })
export const typesQuery = () =>
  queryOptions({
    queryKey: ['types'],
    queryFn: async () => unwrap(await listTypes()),
    staleTime: 300_000,
  })
export const practiceGoalQuery = () =>
  queryOptions({
    queryKey: ['practice-goal'],
    queryFn: async () => unwrap(await getPracticeGoal()),
    staleTime: 30_000,
  })
export const sessionQuery = (id: number) =>
  queryOptions({
    queryKey: ['sessions', id],
    queryFn: async () => unwrap(await getSession({ data: id })),
    staleTime: 30_000,
  })
