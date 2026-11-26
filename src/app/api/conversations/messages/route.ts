import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth/server-guard";
import { insertServerNotifications } from "@/lib/notifications/server-notify";

const sendMessageSchema = z.object({
  conversationId: z.string().uuid("Conversación inválida"),
  text: z.string().trim().min(1, "Escribe un mensaje").max(2000, "Máximo 2000 caracteres"),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth(["owner", "tenant", "admin"]);
  if (!auth.ok) return auth.response;
  const { user, profile, supabase } = auth.ctx;

  const body = await request.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Mensaje inválido" },
      { status: 400 }
    );
  }

  const { conversationId, text } = parsed.data;
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, owner_id, tenant_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }
  const isOwner = conv.owner_id === user.id;
  const isTenant = conv.tenant_id === user.id;
  if (!isOwner && !isTenant) {
    return NextResponse.json({ error: "No autorizado para escribir en esta conversación" }, { status: 403 });
  }

  const senderLabel = isOwner ? "owner" : "tenant";
  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender: senderLabel,
    text,
  });

  if (msgErr) {
    return NextResponse.json({ error: msgErr.message }, { status: 400 });
  }

  const recipientId = isOwner ? conv.tenant_id : conv.owner_id;
  if (recipientId) {
    await insertServerNotifications([
      {
        user_id: recipientId,
        type: "new_message",
        title: `Nuevo mensaje de ${profile.full_name || "usuario"}`,
        message: text.length > 100 ? `${text.slice(0, 97)}...` : text,
        link: isOwner ? "/tenant/messages" : "/owner/messages",
      },
    ]);
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: messages ?? [] }, { status: 201 });
}
