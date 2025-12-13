import * as Icons from "lucide-react";
import { Link as LinkIcon, LucideIcon } from "lucide-react";

interface IconRenderProps {
  name: string;
  className?: string;
}

export const IconRender = ({ name, className }: IconRenderProps) => {
  if (name?.startsWith("http") || name?.startsWith("/")) {
    return (
      <img 
        src={name} 
        alt="icon" 
        className={`${className} object-contain rounded-sm`} 
        loading="lazy"
      />
    );
  }
  
  const IconComponent = (Icons[name as keyof typeof Icons] as LucideIcon) || LinkIcon;
  return <IconComponent className={className} />;
};
