import { useState } from "react";
import { useContracts } from "@/hooks/useContracts";
import { useItemSharing } from "@/hooks/useItemSharing";
import { ContractManager } from "./ContractManager";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { PanelShell } from "@/components/ui/panel-shell";
import { FileText } from "lucide-react";

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

  return (
    <PanelShell
      icon={FileText}
      title="Contracts"
      subtitle={`${activeContracts.length} active · €${monthlyCost.toFixed(0)}/mo`}
      loading={loading}
      loadingVariant="cards"
      noPadding
    >
      <div className="p-3 md:p-4">
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
            onShare={(email, permission) =>
              shareItem("contract", shareDialog.id, email, permission)
            }
            onGetSharedWith={() => getSharedWith("contract", shareDialog.id)}
            onRemoveShare={async (shareId) => {
              const { error } = await removeShare(shareId);
              return { error: error ? error.message : null };
            }}
            onGetRecentContacts={getRecentContacts}
            onClose={() => setShareDialog(null)}
          />
        )}
      </div>
    </PanelShell>
  );
}
