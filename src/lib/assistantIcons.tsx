import {
  MessagesSquare,
  ClipboardCheck,
  BookOpen,
  GraduationCap,
  FileCheck2,
  Calendar,
} from "lucide-react";

export const getAssistantIcon = (assistantName: string) => {
  const iconMap: Record<string, JSX.Element> = {
    "Övrigt": <MessagesSquare className="h-4 w-4" />,
    "Bedömning": <ClipboardCheck className="h-4 w-4" />,
    "Läxa": <BookOpen className="h-4 w-4" />,
    "Lektion": <GraduationCap className="h-4 w-4" />,
    "Prov": <FileCheck2 className="h-4 w-4" />,
    "Planering": <Calendar className="h-4 w-4" />,
  };

  return iconMap[assistantName] || <MessagesSquare className="h-4 w-4" />;
};
