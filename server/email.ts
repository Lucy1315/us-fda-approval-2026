import { config } from "dotenv";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

// .env 파일에서 환경변수 로드
config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// SMTP 설정 (환경변수 또는 기본값)
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || "465");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

interface SendEmailRequest {
  to: string[];
  subject: string;
  html: string;
  attachmentBase64: string;
  attachmentFilename: string;
}

app.post("/api/send-email", async (req, res) => {
  try {
    const body = req.body as SendEmailRequest;

    // 입력 검증
    if (!body.to || body.to.length === 0) {
      return res.status(400).json({ success: false, error: "수신자 이메일이 필요합니다." });
    }
    if (!body.subject || !body.html) {
      return res.status(400).json({ success: false, error: "제목과 본문이 필요합니다." });
    }
    if (!SMTP_USER || !SMTP_PASS) {
      return res.status(500).json({
        success: false,
        error: "SMTP 설정이 완료되지 않았습니다. SMTP_USER, SMTP_PASS 환경변수를 설정하세요.",
      });
    }

    // Nodemailer 트랜스포터 생성
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // base64 → Buffer 변환
    const attachmentBuffer = Buffer.from(body.attachmentBase64, "base64");

    // 이메일 발송
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: body.to.join(", "),
      subject: body.subject,
      html: body.html,
      attachments: [
        {
          filename: body.attachmentFilename,
          content: attachmentBuffer,
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    });

    console.log("이메일 전송 완료:", info.messageId);

    return res.json({
      success: true,
      messageId: info.messageId,
      message: `${body.to.length}명에게 이메일이 전송되었습니다.`,
    });
  } catch (err) {
    console.error("이메일 전송 오류:", err);
    return res.status(500).json({
      success: false,
      error: `이메일 전송 실패: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// 상태 확인 엔드포인트
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    smtp: {
      host: SMTP_HOST,
      port: SMTP_PORT,
      user: SMTP_USER ? `${SMTP_USER.slice(0, 3)}***` : "(미설정)",
    },
  });
});

const PORT = Number(process.env.EMAIL_PORT || "3001");
app.listen(PORT, () => {
  console.log(`\n📧 이메일 서버 실행 중: http://localhost:${PORT}`);
  console.log(`   SMTP: ${SMTP_HOST}:${SMTP_PORT}`);
  console.log(`   계정: ${SMTP_USER || "(미설정 - SMTP_USER 환경변수 필요)"}`);
  console.log(`   상태 확인: http://localhost:${PORT}/api/health\n`);
});
