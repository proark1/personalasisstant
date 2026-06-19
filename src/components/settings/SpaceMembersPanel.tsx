import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  Check,
  X,
  Briefcase,
  Home,
  Heart,
  Building2,
  FileText,
  Contact,
  Calendar,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useSpaceMembers, SpaceMember } from "@/hooks/useSpaceMembers";
import { CallButton } from "@/components/calling/CallButton";
import { OnlineIndicator } from "@/components/calling/OnlineIndicator";
import { useCall } from "@/components/calling/CallProvider";

interface SpaceMembersPanelProps {
  userId: string;
}

export function SpaceMembersPanel({ userId }: SpaceMembersPanelProps) {
  const {
    members,
    invitations,
    shareSettings,
    inviteMember,
    acceptInvitation,
    declineInvitation,
    removeMember,
    updateShareSettings,
  } = useSpaceMembers(userId);

  const { startVideoCall, startAudioCall, isOnline } = useCall();

  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [_selectedMember] = useState<SpaceMember | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    await inviteMember(inviteEmail.trim());
    setInviteEmail("");
    setIsInviting(false);
  };

  const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-success/20 text-success";
      case "pending":
        return "bg-warning/20 text-warning";
      case "declined":
        return "bg-destructive/20 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const _settings = _selectedMember ? shareSettings[_selectedMember.id] : null;

  const ShareSettingRow = ({
    label,
    icon: Icon,
    checked,
    onCheckedChange,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-warning" />
              Pending Invitations
            </CardTitle>
            <CardDescription>You have been invited to join these spaces</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-primary/20">
                      {getInitials(inv.member_profile?.display_name, inv.member_profile?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {inv.member_profile?.display_name ||
                        inv.member_profile?.email ||
                        "Unknown User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Wants to share their space with you
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => declineInvitation(inv.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={() => acceptInvitation(inv.id)}>
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invite New Member */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Invite Team Member
          </CardTitle>
          <CardDescription>Add someone to your space and control what they can see</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter email address"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <Button onClick={handleInvite} disabled={isInviting || !inviteEmail.trim()}>
              {isInviting ? "Sending..." : "Invite"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Space Members
          </CardTitle>
          <CardDescription>People you're sharing your space with</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No team members yet</p>
              <p className="text-xs">Invite someone to start sharing</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {members.map((member) => {
                  const memberSettings = shareSettings[member.id];
                  const isExpanded = expandedMember === member.id;

                  return (
                    <div key={member.id} className="border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-primary/20">
                                {getInitials(
                                  member.member_profile?.display_name,
                                  member.member_email,
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <OnlineIndicator
                              isOnline={isOnline(member.member_id)}
                              className="absolute -bottom-0.5 -right-0.5"
                              size="sm"
                            />
                          </div>
                          <div>
                            <p className="font-medium">
                              {member.member_profile?.display_name || member.member_email}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.member_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.status === "accepted" && (
                            <CallButton
                              onVideoCall={() => startVideoCall(member.member_id)}
                              onAudioCall={() => startAudioCall(member.member_id)}
                              isOnline={isOnline(member.member_id)}
                            />
                          )}
                          <Badge variant="secondary" className={getStatusColor(member.status)}>
                            {member.status}
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {isExpanded && memberSettings && (
                        <div className="border-t bg-muted/30 p-4 space-y-4">
                          {/* Security Warning Banner */}
                          {!memberSettings.sharing_confirmed && (
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30">
                              <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-warning">
                                  Data Sharing Not Confirmed
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Enabling sharing will allow this person to view your selected
                                  data. Personal documents, family health records, and sensitive
                                  files are <strong>never</strong> shared.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="mt-2 border-warning/50 text-warning hover:bg-warning/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateShareSettings(member.id, {
                                      sharing_confirmed: true,
                                      confirmed_at: new Date().toISOString(),
                                      consent_message: "User confirmed data sharing consent",
                                    });
                                  }}
                                >
                                  <ShieldCheck className="w-4 h-4 mr-2" />I understand, enable
                                  sharing
                                </Button>
                              </div>
                            </div>
                          )}

                          {memberSettings.sharing_confirmed && (
                            <div className="flex items-center gap-2 text-xs text-success">
                              <ShieldCheck className="w-4 h-4" />
                              <span>
                                Sharing confirmed on{" "}
                                {new Date(memberSettings.confirmed_at || "").toLocaleDateString()}
                              </span>
                            </div>
                          )}

                          <div>
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <Briefcase className="w-4 h-4" />
                              Tasks Sharing
                            </h4>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-6">
                              <ShareSettingRow
                                label="Business Tasks"
                                icon={Building2}
                                checked={memberSettings.share_business_tasks}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_business_tasks: checked })
                                }
                              />
                              <ShareSettingRow
                                label="Personal Tasks"
                                icon={Home}
                                checked={memberSettings.share_personal_tasks}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_personal_tasks: checked })
                                }
                              />
                              <ShareSettingRow
                                label="Family Tasks"
                                icon={Heart}
                                checked={memberSettings.share_family_tasks}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_family_tasks: checked })
                                }
                              />
                              <ShareSettingRow
                                label="Work Tasks"
                                icon={Briefcase}
                                checked={memberSettings.share_work_tasks}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_work_tasks: checked })
                                }
                              />
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              Events Sharing
                            </h4>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-6">
                              <ShareSettingRow
                                label="Business Events"
                                icon={Building2}
                                checked={memberSettings.share_business_events}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_business_events: checked })
                                }
                              />
                              <ShareSettingRow
                                label="Personal Events"
                                icon={Home}
                                checked={memberSettings.share_personal_events}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_personal_events: checked })
                                }
                              />
                              <ShareSettingRow
                                label="Family Events"
                                icon={Heart}
                                checked={memberSettings.share_family_events}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_family_events: checked })
                                }
                              />
                              <ShareSettingRow
                                label="Work Events"
                                icon={Briefcase}
                                checked={memberSettings.share_work_events}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_work_events: checked })
                                }
                              />
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              Other Data
                            </h4>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-6">
                              <ShareSettingRow
                                label="Contracts"
                                icon={FileText}
                                checked={memberSettings.share_contracts}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_contracts: checked })
                                }
                              />
                              <ShareSettingRow
                                label="Contacts"
                                icon={Contact}
                                checked={memberSettings.share_contacts}
                                onCheckedChange={(checked) =>
                                  updateShareSettings(member.id, { share_contacts: checked })
                                }
                              />
                            </div>
                          </div>

                          <Separator />

                          <div className="flex justify-end">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeMember(member.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove Member
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
