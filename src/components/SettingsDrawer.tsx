import { Settings, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssistantSettings } from "@/hooks/useAssistantSettings";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface SettingsDrawerProps {
  assistantId: string | null;
  assistantName: string | null;
  onDeleteAllConversations: () => void;
}

export const SettingsDrawer = ({
  assistantId,
  assistantName,
  onDeleteAllConversations,
}: SettingsDrawerProps) => {
  const { settings, isLoading, updateSetting } = useAssistantSettings(assistantId);
  const isChatGPT = assistantId === "chatgpt";

  if (!assistantId || !assistantName) {
    return null;
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Inställningar</SheetTitle>
          <SheetDescription>
            Inställningar för {assistantName}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Laddar inställningar...
          </div>
        ) : settings ? (
          <div className="space-y-6 py-6">
            {/* Assistant Information */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Assistant Information</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Namn: {assistantName}</p>
                <p>ID: {assistantId}</p>
                {settings.model && <p>Modell: {settings.model}</p>}
              </div>
            </div>

            <Separator />

            {/* Model Selection - Only for ChatGPT */}
            {isChatGPT && (
              <>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="model">Modell</Label>
                    <Select
                      value={settings.model || "gpt-5-mini-2025-08-07"}
                      onValueChange={(value) => updateSetting("model", value)}
                    >
                      <SelectTrigger id="model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-5-nano-2025-08-07">GPT-5 Nano (Snabbast)</SelectItem>
                        <SelectItem value="gpt-5-mini-2025-08-07">GPT-5 Mini (Rekommenderad)</SelectItem>
                        <SelectItem value="gpt-5-2025-08-07">GPT-5 (Mest kapabel)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Välj vilken GPT-modell som ska användas
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Function Calling - Only for OpenAI Assistants */}
            {!isChatGPT && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="function-calling">Function Calling</Label>
                      <p className="text-xs text-muted-foreground">
                        Tillåt assistenten att använda verktyg och funktioner
                      </p>
                    </div>
                    <Switch
                      id="function-calling"
                      checked={settings.enable_function_calling}
                      onCheckedChange={(checked) =>
                        updateSetting("enable_function_calling", checked)
                      }
                    />
                  </div>
                </div>
                <Separator />
              </>
            )}


            {/* Temperature */}
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <span className="text-sm text-muted-foreground">
                    {settings.temperature?.toFixed(1) || "1.0"}
                  </span>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[settings.temperature || 1.0]}
                  onValueChange={([value]) => updateSetting("temperature", value)}
                />
                <p className="text-xs text-muted-foreground">
                  Lägre värden ger mer fokuserade svar, högre värden ger mer kreativa svar
                </p>
              </div>
            </div>

            <Separator />

            {/* Max Tokens */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="max-tokens">Max Tokens</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  min={100}
                  max={4000}
                  value={settings.max_tokens || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      updateSetting("max_tokens", value);
                    }
                  }}
                  placeholder="Lämna tom för standard"
                />
                <p className="text-xs text-muted-foreground">
                  Maximal längd på svar (100-4000 tokens)
                </p>
              </div>
            </div>

            <Separator />

            {/* Custom Instructions */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="custom-instructions">Anpassade instruktioner</Label>
                <Textarea
                  id="custom-instructions"
                  value={settings.custom_instructions || ""}
                  onChange={(e) => updateSetting("custom_instructions", e.target.value)}
                  placeholder="Lägg till specifika instruktioner för assistenten..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Dessa instruktioner läggs till i systemmeddelandet
                </p>
              </div>
            </div>

            <Separator />

            {/* Conversation Management */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Konversationshantering</h3>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Radera alla konversationer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Är du säker?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Detta kommer att radera alla konversationer för {assistantName}. 
                      Denna åtgärd kan inte ångras.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Avbryt</AlertDialogCancel>
                    <AlertDialogAction onClick={onDeleteAllConversations}>
                      Radera alla
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Kunde inte ladda inställningar
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
