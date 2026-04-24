/**
 * InfrastructureProvider — installs the cross-module coordination layer.
 *
 * Wires:
 *  - CacheCoordinator: ModuleEventBus events → React Query invalidations
 *  - Workspace switch broadcaster: WorkspaceContext changes → moduleBus
 *
 * Mount once at the top of the tree (inside QueryClientProvider and the
 * Workspace/Auth providers, since those define the data this layer routes).
 */
import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { installCacheCoordinator } from '@/lib/cacheCoordinator';
import { moduleBus } from '@/lib/moduleEventBus';
import { useActiveWorkspaceId } from '@/contexts/WorkspaceContext';

export function InfrastructureProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const activeWorkspaceId = useActiveWorkspaceId();

  // Wire moduleBus → query invalidations.
  useEffect(() => {
    return installCacheCoordinator(queryClient);
  }, [queryClient]);

  // Broadcast workspace switches so all dependent caches can flush.
  useEffect(() => {
    if (activeWorkspaceId !== undefined) {
      moduleBus.emit('workspace:switched', { workspaceId: activeWorkspaceId }, 'WorkspaceContext');
    }
  }, [activeWorkspaceId]);

  return <>{children}</>;
}
