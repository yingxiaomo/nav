import * as Icons from "lucide-react";
import { Link as LinkIcon, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PRESET_ICONS = [
  "Bot", "Brain", "Sparkles", "Cpu", "Microchip", "CircuitBoard", "Binary", "Network", "Workflow", "Radio", "Radar", "Rocket", "Telescope", "Atom",
  "Folder", "FolderOpen", "FolderHeart", "FolderKanban", "FolderGit2", "File", "FileText", "FileCode", "FileJson", "Archive", "Inbox", "Briefcase", "Clipboard", "ClipboardList", "Notebook", "StickyNote", "Paperclip", "Printer", "Projector",
  "Terminal", "Code", "Code2", "Braces", "Database", "Server", "HardDrive", "Cloud", "CloudCog", "Laptop", "Monitor", "Smartphone", "Tablet", "Keyboard", "Mouse", "Bug", "GitBranch", "Command", "Box", "Container", "Blocks",
  "Palette", "PenTool", "Brush", "Eraser", "Image", "ImageIcon", "Camera", "Aperture", "Video", "Film", "Clapperboard", "Music", "Headphones", "Mic", "Speaker", "Play", "Layers", "Component", "Contrast", "Feather",
  "Book", "BookOpen", "Library", "Bookmark", "GraduationCap", "School", "Pencil", "Pen", "Highlighter", "Languages", "Quote", "History",
  "Home", "Building", "Tent", "ShoppingBag", "ShoppingCart", "CreditCard", "Wallet", "PiggyBank", "Gift", "Coffee", "Utensils", "UtensilsCrossed", "Wine", "Beer", "Pizza", "Cookie", "PartyPopper", "Gamepad", "Gamepad2", "Ghost", "Skull", "Dice5", "Ticket",
  "Map", "MapPin", "Navigation", "Compass", "Globe", "Globe2", "Plane", "Car", "Bus", "Train", "Bike", "Ship", "Anchor", "Sun", "Moon", "CloudRain", "Umbrella", "Flame", "Snowflake", "Leaf", "Flower2",
  "Settings", "Wrench", "Hammer", "Construction", "Wifi", "Signal", "Bluetooth", "Battery", "BatteryCharging", "Zap", "Flashlight", "Lock", "Unlock", "Key", "Shield", "Eye", "Bell", "Trash2", "Download", "Upload", "Share2", "Flag", "Star", "Heart", "Trophy", "Crown", "Medal", "Target"
];

export const IconRender = ({ name, className }: { name: string; className?: string }) => {
  if (name?.startsWith("http") || name?.startsWith("/")) {
    return <img src={name} alt="icon" className={`${className} object-contain rounded-sm`} />;
  }
  // @ts-ignore
  const Icon = (Icons[name as keyof typeof Icons] as LucideIcon) || LinkIcon;
  return <Icon className={className} />;
};