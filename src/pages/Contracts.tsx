import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useContracts } from '@/hooks/useContracts';
import { ContractManager } from '@/components/contracts/ContractManager';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ContractsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    contracts,
    activeContracts,
    loading,
    addContract,
    updateContract,
    deleteContract,
    monthlyCost,
    yearlyCost,
    contractsByCategory,
    getExpiringContracts,
    getCancellationDeadlines,
  } = useContracts(user?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading contracts...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Button>
        </div>

        <ContractManager
          contracts={contracts}
          activeContracts={activeContracts}
          monthlyCost={monthlyCost}
          yearlyCost={yearlyCost}
          contractsByCategory={contractsByCategory}
          onAdd={addContract}
          onUpdate={updateContract}
          onDelete={deleteContract}
          getExpiringContracts={getExpiringContracts}
          getCancellationDeadlines={getCancellationDeadlines}
        />
      </div>
    </div>
  );
}
