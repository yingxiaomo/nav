import { useState, useEffect } from "react";
import * as Icons from "lucide-react";
import { Link as LinkIcon, LucideIcon } from "lucide-react";

interface IconRenderProps {
  name: string;
  className?: string;
}

export const IconRender = ({ name, className }: IconRenderProps) => {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [name]);

  if ((name?.startsWith("http") || name?.startsWith("/")) && !error) {
    return (
      <img 
        src={name} 
        alt="icon" 
        className={`${className} object-contain rounded-sm`} 
        loading="lazy"
        onError={() => setError(true)}
      />
    );
  }
  
  const iconName = name as keyof typeof Icons;
  // Ensure the icon exists AND is a function (React component)
  const isValidIcon = name && !error && /^[A-Z]/.test(name) && Boolean(Icons[iconName]);
  
  const IconComponent = isValidIcon ? Icons[iconName] : LinkIcon;
  const Icon = IconComponent as LucideIcon;
  
  return <Icon className={className} />;
};
