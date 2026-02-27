import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string[];
  subject: string;
  html: string;
  attachmentBase64: string;
  attachmentFilename: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendEmailRequest;

    // 입력 검증
    if (!body.to || body.to.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "수신자 이메일이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!body.subject || !body.html) {
      return new Response(
        JSON.stringify({ success: false, error: "제목과 본문이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SMTP 환경변수 확인
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Number(Deno.env.get("SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ success: false, error: "SMTP 설정이 완료되지 않았습니다. (SMTP_HOST, SMTP_USER, SMTP_PASS 필요)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // base64 → Uint8Array 변환
    const binaryStr = atob(body.attachmentBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // SMTP 클라이언트 생성
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    // 이메일 발송
    await client.send({
      from: smtpFrom!,
      to: body.to.join(", "),
      subject: body.subject,
      content: "이메일 클라이언트가 HTML을 지원하지 않습니다.",
      html: body.html,
      attachments: [
        {
          filename: body.attachmentFilename,
          content: bytes,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          encoding: "binary",
        },
      ],
    });

    await client.close();

    return new Response(
      JSON.stringify({
        success: true,
        message: `${body.to.length}명에게 이메일이 전송되었습니다.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ success: false, error: `이메일 전송 실패: ${String(err)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
