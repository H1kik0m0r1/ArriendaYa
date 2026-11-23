"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function MessagesPage() {
  const supabase = createClient();
  const [conversations, setConversations] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("conversations").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
    setConversations(data || []);
  };

  useEffect(() => { loadConversations(); }, [supabase]);

  const open = async (c: any) => {
    setActive(c);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", c.id).order("created_at", { ascending: true });
    setMessages(data || []);
  };

  const send = async () => {
    if (!text.trim() || !active) return;
    await supabase.from("messages").insert({ conversation_id: active.id, sender: "owner", text, created_at: new Date().toISOString() });
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", active.id).order("created_at", { ascending: true });
    setMessages(data || []);
    setText("");
  };

  const newConv = async () => {
    const email = prompt("Correo del inquilino:");
    if (!email) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("conversations").insert({ owner_id: user.id, tenant_email: email }).select().single();
    if (data) {
      setConversations((prev) => [data, ...prev]);
      open(data);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Conversaciones</h2>
          <Button size="sm" onClick={newConv}>Nueva</Button>
        </div>
        <ul className="flex flex-col gap-1">
          {conversations.map((c) => (
            <li key={c.id}>
              <button onClick={() => open(c)} className={`w-full text-left text-sm ${active?.id === c.id ? "font-bold text-primary" : ""}`}>
                {c.tenant_email}
              </button>
            </li>
          ))}
          {conversations.length === 0 && <li className="text-muted text-sm">Sin conversaciones.</li>}
        </ul>
        <div className="mt-4">
          <p className="text-xs font-medium">Respuestas rápidas</p>
          {["Solicitud recibida", "Documentación incompleta", "Contrato disponible para firmar"].map((r) => (
            <button key={r} onClick={() => setText(r)} className="block w-full text-left text-xs text-primary hover:underline">{r}</button>
          ))}
        </div>
      </div>
      <div className="md:col-span-2 rounded-xl border border-border bg-card p-4">
        {!active && <p className="text-muted">Selecciona una conversación.</p>}
        {active && (
          <>
            <div className="mb-2 h-64 overflow-y-auto rounded border border-border p-2">
              {messages.map((m) => (
                <div key={m.id} className={`mb-1 text-sm ${m.sender === "owner" ? "text-right" : ""}`}>
                  <span className="inline-block rounded bg-gray-100 px-2 py-1">{m.text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensaje..." />
              <Button onClick={send}>Enviar</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
