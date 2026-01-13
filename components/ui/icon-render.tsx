import { useState } from "react";
import Image from 'next/image';
import * as Icons from "lucide-react";
import { Link as LinkIcon, LucideIcon } from "lucide-react";

interface IconRenderProps {
  name: string;
  className?: string;
}

export const IconRender = ({ name, className }: IconRenderProps) => {
  const [error, setError] = useState(false);

  const handleError = () => {
    setError(true);
  };

  if ((name?.startsWith("http") || name?.startsWith("/")) && !error) {
    return (
      <Image 
        src={name} 
        alt="icon" 
        width={32} 
        height={32} 
        className={`${className} object-contain rounded-sm`} 
        loading="lazy"
        onError={handleError}
      />
    );
  }
  
  const iconName = name as keyof typeof Icons;
  const isValidIcon = name && /^[A-Z]/.test(name) && Boolean(Icons[iconName]);
  const IconComponent = isValidIcon ? Icons[iconName] : LinkIcon;
  const Icon = IconComponent as LucideIcon;
  
  return <Icon className={className} />;
};
