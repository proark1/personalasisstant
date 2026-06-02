import { useMemo } from 'react';
import { Contact } from '@/hooks/useContacts';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
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

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

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

    neglectedList.sort((a, b) => b.daysPastDue - a.daysPastDue);
    const topNeglected = neglectedList.slice(0, 5).map(n => n.contact);

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
    <motion.div
      className="space-y-4"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
    >
      {/* Overall Health Score */}
      <motion.div variants={fadeIn}>
        <GlassCard>
          <GlassCardHeader className="pb-2">
            <GlassCardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Network Health
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
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
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Heart, color: 'text-red-500', label: 'Personal', value: metrics.personalCount },
          { icon: Briefcase, color: 'text-blue-500', label: 'Business', value: metrics.businessCount },
          { icon: CheckCircle, color: 'text-green-500', label: 'Healthy', value: metrics.healthyCount },
          { icon: AlertCircle, color: 'text-orange-500', label: 'Overdue', value: metrics.overdueCount },
        ].map((stat) => (
          <motion.div key={stat.label} variants={fadeIn}>
            <GlassCard className="p-4">
              <div className="flex items-center gap-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Additional Stats */}
      <motion.div variants={fadeIn}>
        <GlassCard>
          <GlassCardContent className="pt-4 space-y-4">
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
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Neglected Contacts */}
      {metrics.topNeglected.length > 0 && (
        <motion.div variants={fadeIn}>
          <GlassCard>
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2 text-orange-500">
                <AlertCircle className="w-4 h-4" />
                Most Neglected Contacts
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
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
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  );
}
