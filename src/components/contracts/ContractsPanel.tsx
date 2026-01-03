import { useContracts } from '@/hooks/useContracts';
import { ContractManager } from './ContractManager';

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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
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
      />
    </div>
  );
}
