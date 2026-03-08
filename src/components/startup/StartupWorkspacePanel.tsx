import { useState } from 'react';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Briefcase, Gamepad, Brain, TrendingUp, Users, DollarSign, BarChart3 } from 'lucide-react';
import { useStartupWorkspaces } from '@/hooks/useStartupWorkspaces';
import { cn } from '@/lib/utils';
import { PanelShell } from '@/components/ui/panel-shell';

const WORKSPACE_ICONS: Record<string, React.ReactNode> = {
  gaming: <Gamepad className="w-5 h-5" />,
  ai: <Brain className="w-5 h-5" />,
  agency: <TrendingUp className="w-5 h-5" />,
  custom: <Briefcase className="w-5 h-5" />,
};

export function StartupWorkspacePanel() {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    getWorkspaceMetrics,
    loading,
  } = useStartupWorkspaces();

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspace);
  const workspaceMetrics = activeWorkspace ? getWorkspaceMetrics(activeWorkspace) : [];

  const workspaceTabs = (
    <div className="flex items-center gap-2 overflow-x-auto">
      {workspaces.map((workspace) => (
        <Button
          key={workspace.id}
          variant={activeWorkspace === workspace.id ? 'secondary' : 'ghost'}
          size="sm"
          className={cn("gap-2 shrink-0", activeWorkspace === workspace.id && "shadow-sm")}
          style={{ borderColor: activeWorkspace === workspace.id ? workspace.color : undefined }}
          onClick={() => setActiveWorkspace(workspace.id)}
        >
          <span style={{ color: workspace.color }}>
            {WORKSPACE_ICONS[workspace.workspace_type] || WORKSPACE_ICONS.custom}
          </span>
          {workspace.name}
        </Button>
      ))}
    </div>
  );

  return (
    <PanelShell
      icon={Briefcase}
      title="Startup Workspaces"
      loading={loading}
      loadingVariant="cards"
      headerExtra={workspaceTabs}
      noPadding
      empty={!currentWorkspace && !loading}
      emptyIcon={Briefcase}
      emptyTitle="Select a workspace"
      emptyDescription="Choose a workspace to get started"
    >
      {currentWorkspace && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className="p-3 rounded-xl"
                style={{ backgroundColor: currentWorkspace.color + '20' }}
              >
                <span style={{ color: currentWorkspace.color }}>
                  {WORKSPACE_ICONS[currentWorkspace.workspace_type] || WORKSPACE_ICONS.custom}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold">{currentWorkspace.name}</h3>
                {currentWorkspace.description && (
                  <p className="text-sm text-muted-foreground">{currentWorkspace.description}</p>
                )}
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <GlassCard className="p-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground">Team Size</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground">MRR</p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <BarChart3 className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                <p className="text-2xl font-bold">-</p>
                <p className="text-xs text-muted-foreground">Growth</p>
              </GlassCard>
            </div>

            {/* Metrics */}
            <GlassCard className="p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Key Metrics
              </h4>
              {workspaceMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No metrics tracked yet. Add metrics to monitor your startup's progress.
                </p>
              ) : (
                <div className="space-y-2">
                  {workspaceMetrics.slice(0, 5).map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm capitalize">{metric.metric_name.replace(/_/g, ' ')}</span>
                      <Badge variant="outline">{metric.metric_value}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            {/* Quick Actions */}
            <GlassCard className="p-4">
              <h4 className="font-medium mb-3">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="justify-start">View Tasks</Button>
                <Button variant="outline" size="sm" className="justify-start">Team Notes</Button>
                <Button variant="outline" size="sm" className="justify-start">Contacts</Button>
                <Button variant="outline" size="sm" className="justify-start">Add Metric</Button>
              </div>
            </GlassCard>
          </div>
        </ScrollArea>
      )}
    </PanelShell>
  );
}
