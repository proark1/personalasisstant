import { useState, useRef } from 'react';
import { useFamilyDocuments, FamilyDocument } from '@/hooks/useFamilyDocuments';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, Upload, Trash2, Download, AlertCircle, Search,
  CreditCard, Shield, FileCheck, Folder, Eye
} from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { AddDocumentDialog } from './AddDocumentDialog';

const categoryIcons: Record<string, any> = {
  id: CreditCard,
  insurance: Shield,
  medical: FileCheck,
  legal: FileText,
  education: FileText,
  other: Folder,
};

const categoryColors: Record<string, string> = {
  id: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  insurance: 'bg-green-500/20 text-green-700 dark:text-green-400',
  medical: 'bg-red-500/20 text-red-700 dark:text-red-400',
  legal: 'bg-purple-500/20 text-purple-700 dark:text-purple-400',
  education: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  other: 'bg-muted text-muted-foreground',
};

export function DocumentStoragePanel() {
  const { documents, isLoading, deleteDocument, getSignedUrl, getExpiringDocuments } = useFamilyDocuments();
  const { members } = useFamilyMembers();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getMemberName = (id: string | null) => {
    if (!id) return 'Family';
    return members.find(m => m.id === id)?.name || 'Unknown';
  };

  const handleDownload = async (doc: FamilyDocument) => {
    const url = await getSignedUrl(doc.file_path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const expiringDocs = getExpiringDocuments(30);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const categories = ['id', 'insurance', 'medical', 'legal', 'education', 'other'];

  return (
    <div className="space-y-4">
      {/* Expiring Documents Alert */}
      {expiringDocs.length > 0 && (
        <Card className="p-3 border-amber-500/50 bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {expiringDocs.length} document(s) expiring within 30 days
            </span>
          </div>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Button>
        {categories.map((cat) => {
          const Icon = categoryIcons[cat] || Folder;
          return (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              <Icon className="h-4 w-4 mr-1" />
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          );
        })}
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No documents</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload important family documents for safekeeping
          </p>
          <Button onClick={() => setShowAddDialog(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredDocuments.map((doc) => {
            const Icon = categoryIcons[doc.category] || Folder;
            const isExpiringSoon = doc.expiry_date && 
              new Date(doc.expiry_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
              isFuture(new Date(doc.expiry_date));
            const isExpired = doc.expiry_date && isPast(new Date(doc.expiry_date));

            return (
              <Card key={doc.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${categoryColors[doc.category] || categoryColors.other}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{doc.name}</h3>
                      {doc.is_sensitive && (
                        <Shield className="h-3 w-3 text-amber-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getMemberName(doc.family_member_id)}
                      </Badge>
                      {doc.file_size && (
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(doc.file_size)}
                        </span>
                      )}
                    </div>
                    {doc.expiry_date && (
                      <div className={`text-xs mt-2 ${
                        isExpired ? 'text-destructive' : 
                        isExpiringSoon ? 'text-amber-600' : 'text-muted-foreground'
                      }`}>
                        {isExpired ? 'Expired: ' : 'Expires: '}
                        {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteDocument(doc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AddDocumentDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
}
