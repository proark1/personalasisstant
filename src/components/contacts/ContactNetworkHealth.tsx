import { useMemo } from 'react';
import { Contact } from '@/hooks/useContacts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, TrendingDown, Users, AlertCircle, 
  CheckCircle, Clock, Heart, Briefcase 
} from 'lucide-react';
import { isPast, differenceInDays } from 'date-fns';

interface ContactNetworkHealthProps {
  contacts: Contact[];
}

interface NetworkMetrics {
  overallHealth: number;
  totalContacts: number;
  personalCount: number;
  businessCount: number;
  overdueCount: number;
  healthyCount: number;
  neglectedCount: number;
  recentlyContactedCount: number;
  avgContactFrequency: number;
  topNeglected: Contact[];
}

export function ContactNetworkHealth({ contacts }: ContactNetworkHealthProps) {
  const metrics = useMemo((): NetworkMetrics => {
    const now = new Date();
    let overdueCount = 0;
    let healthyCount = 0;
    let neglectedCount = 0;
    let recentlyContactedCount = 0;
    let totalFrequency = 0;

    const neglectedList: { contact: Contact; daysPastDue: number }[] = [];

    contacts.forEach(contact => {
      totalFrequency += contact.contactFrequencyDays;

      if (contact.nextContactDue) {
        if (isPast(contact.nextContactDue)) {
          overdueCount++;
          const daysPastDue = differenceInDays(now, contact.nextContactDue);
          if (daysPastDue > 30) {
            neglectedCount++;
            neglectedList.push({ contact, daysPastDue });
          }
        } else {
          healthyCount++;
        }
      }

      if (contact.lastContactedAt) {
        const daysSinceContact = differenceInDays(now, contact.lastContactedAt);
        if (daysSinceContact <= 7) {
          recentlyContactedCount++;
        }
      }
    });

    // Sort neglected by days past due (most neglected first)
    neglectedList.sort((a, b) => b.daysPastDue - a.daysPastDue);
    const topNeglected = neglectedList.slice(0, 5).map(n => n.contact);

    // Calculate overall health score (0-100)
    const totalWithDue = overdueCount + healthyCount;
    const healthRatio = totalWithDue > 0 ? healthyCount / totalWithDue : 1;
    const overallHealth = Math.round(healthRatio * 100);

    const personalCount = contacts.filter(c => c.contactType === 'personal').length;
    const businessCount = contacts.filter(c => c.contactType === 'business').length;
    const avgContactFrequency = contacts.length > 0 ? Math.round(totalFrequency / contacts.length) : 30;

    return {
      overallHealth,
      totalContacts: contacts.length,
      personalCount,
      businessCount,
      overdueCount,
      healthyCount,
      neglectedCount,
      recentlyContactedCount,
      avgContactFrequency,
      topNeglected,
    };
  }, [contacts]);

  const getHealthColor = (health: number) => {
    if (health >= 80) return 'text-green-500';
    if (health >= 60) return 'text-yellow-500';
    if (health >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getHealthLabel = (health: number) => {
    if (health >= 80) return 'Excellent';
    if (health >= 60) return 'Good';
    if (health >= 40) return 'Needs Attention';
    return 'Critical';
  };

  return (
    <div className="space-y-4">
      {/* Overall Health Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Network Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={`text-4xl font-bold ${getHealthColor(metrics.overallHealth)}`}>
                {metrics.overallHealth}%
              </p>
              <p className="text-sm text-muted-foreground">{getHealthLabel(metrics.overallHealth)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold">{metrics.totalContacts}</p>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
            </div>
          </div>
          <Progress value={metrics.overallHealth} className="h-2" />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            <span className="text-sm text-muted-foreground">Personal</span>
          </div>
          <p className="text-2xl font-bold mt-1">{metrics.personalCount}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Business</span>
          </div>
          <p className="text-2xl font-bold mt-1">{metrics.businessCount}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Healthy</span>
          </div>
          <p className="text-2xl font-bold mt-1">{metrics.healthyCount}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-muted-foreground">Overdue</span>
          </div>
          <p className="text-2xl font-bold mt-1">{metrics.overdueCount}</p>
        </Card>
      </div>

      {/* Additional Stats */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Avg. Contact Frequency</span>
            </div>
            <span className="font-medium">{metrics.avgContactFrequency} days</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Recently Contacted (7d)</span>
            </div>
            <span className="font-medium">{metrics.recentlyContactedCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-sm">Neglected (30+ days overdue)</span>
            </div>
            <Badge variant={metrics.neglectedCount > 0 ? "destructive" : "secondary"}>
              {metrics.neglectedCount}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Neglected Contacts */}
      {metrics.topNeglected.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-500">
              <AlertCircle className="w-4 h-4" />
              Most Neglected Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {metrics.topNeglected.map(contact => (
                <div key={contact.id} className="flex items-center justify-between text-sm">
                  <span>{contact.name}</span>
                  <span className="text-muted-foreground">
                    {contact.nextContactDue 
                      ? `${differenceInDays(new Date(), contact.nextContactDue)} days overdue`
                      : 'No due date'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
