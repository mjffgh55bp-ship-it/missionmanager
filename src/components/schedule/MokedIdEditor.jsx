import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Pencil } from "lucide-react";

export default function MokedIdEditor({ open, templateName, mappingId, onClose, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mappingId || "");
  const [copied, setCopied] = useState(false);

  // Sync when mappingId prop changes (e.g. after save)
  useEffect(() => { setValue(mappingId || ""); }, [mappingId]);

  const handleClose = () => {
    setEditing(false);
    setValue(mappingId || "");
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(mappingId || "").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== mappingId) onSave(trimmed);
    setEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">מזהה מוקד — {templateName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-500">
            המזהה הייחודי של המוקד לצורך סנכרון בין סביבות. שינוי השם אינו משנה את המזהה.
            שנה אותו רק כדי ליישר עם סביבה אחרת.
          </p>

          <div className="flex gap-2 items-center">
            {editing ? (
              <Input
                value={value}
                onChange={e => setValue(e.target.value)}
                className="flex-1 font-mono text-xs"
                dir="ltr"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditing(false); setValue(mappingId || ""); } }}
              />
            ) : (
              <code className="flex-1 bg-gray-100 rounded px-3 py-2 text-xs font-mono break-all select-all">
                {mappingId || "—"}
              </code>
            )}
            <Button size="icon" variant="outline" onClick={handleCopy} title="העתק מזהה">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          {editing ? (
            <>
              <Button onClick={handleSave} className="bg-blue-700 hover:bg-blue-800">שמור</Button>
              <Button variant="outline" onClick={() => { setEditing(false); setValue(mappingId || ""); }}>ביטול</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="w-3 h-3 ml-1" />ערוך מזהה
              </Button>
              <Button variant="outline" onClick={handleClose}>סגור</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}