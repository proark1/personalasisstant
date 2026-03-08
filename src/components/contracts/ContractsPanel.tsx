import { useState } from 'react';
import { useContracts } from '@/hooks/useContracts';
import { useItemSharing } from '@/hooks/useItemSharing';
import { ContractManager } from './ContractManager';
import { ShareDialog } from '@/components/sharing/ShareDialog';
import { PanelSkeleton } from '@/components/ui/panel-skeleton';

interface ContractsPanelProps {
  userId: string;
}

export function ContractsPanel({ userId }: ContractsPanelProps) {
  const {
    contracts,
    activeContracts,
    loading,
    addContract,
    updateContract,
    deleteContract,
    snoozeReminder,
    monthlyCost,
    yearlyCost,
    contractsByCategory,
    getExpiringContracts,
    getCancellationDeadlines,
  } = useContracts(userId);

  const { shareItem, getSharedWith, removeShare, getRecentContacts } = useItemSharing(userId);

  const [shareDialog, setShareDialog] = useState<{ id: string; name: string } | null>(null);

  if (loading) {
    return (
      <div className="h-full p-4">
        <PanelSkeleton variant="cards" count={4} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3 md:p-4">
      <ContractManager
        contracts={contracts}
        activeContracts={activeContracts}
        monthlyCost={monthlyCost}
        yearlyCost={yearlyCost}
        contractsByCategory={contractsByCategory}
        onAdd={addContract}
        onUpdate={updateContract}
        onDelete={deleteContract}
        onSnooze={snoozeReminder}
        getExpiringContracts={getExpiringContracts}
        getCancellationDeadlines={getCancellationDeadlines}
        onShareContract={(id, name) => setShareDialog({ id, name })}
      />

      {shareDialog && (
        <ShareDialog
          itemType="contract"
          itemId={shareDialog.id}
          itemTitle={shareDialog.name}
          onShare={(email, permission) => shareItem('contract', shareDialog.id, email, permission)}
          onGetSharedWith={() => getSharedWith('contract', shareDialog.id)}
          onRemoveShare={removeShare}
          onGetRecentContacts={getRecentContacts}
          onClose={() => setShareDialog(null)}
        />
      )}
    </div>
  );
}
