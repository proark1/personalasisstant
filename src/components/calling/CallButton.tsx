import { Button } from '@/components/ui/button';
import { Phone, Video } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CallButtonProps {
  onVideoCall: () => void;
  onAudioCall: () => void;
  isOnline?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'default' | 'lg' | 'icon';
}

export function CallButton({
  onVideoCall,
  onAudioCall,
  isOnline = false,
  disabled = false,
  size = 'sm',
}: CallButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          disabled={disabled}
          className="relative"
        >
          <Video className="w-4 h-4" />
          {isOnline && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success rounded-full border-2 border-background" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onVideoCall}>
          <Video className="w-4 h-4 mr-2" />
          Video Call
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAudioCall}>
          <Phone className="w-4 h-4 mr-2" />
          Voice Call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
