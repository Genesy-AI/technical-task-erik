import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

/** Fields available in message templates, served by the backend registry (rarely changes). */
export const useTemplateFields = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: ['leads', 'templateFields'],
    queryFn: async () => api.leads.templateFields(),
    staleTime: Infinity,
    enabled,
  })
