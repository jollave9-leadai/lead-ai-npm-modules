// TODO: move the whole package to organization @leadai/modules.

import { createClient } from "@supabase/supabase-js";
import { Client } from "@microsoft/microsoft-graph-client";
import { VapiIntegration } from "./types";

export const initiateCall = async (
  phoneCallPayload: Record<string, unknown>,
  authToken: string
) => {
  const response = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    body: JSON.stringify(phoneCallPayload),
    headers: { Authorization: `Bearer ${authToken}` },
  });
  return response.json();
};

export const convertToVapiCallPayload = (
  customerPhoneNumber: string,
  script: string,
  agentName: string,
  vapiIntegration: VapiIntegration,
): Record<string, unknown> => {
  return {
    assistant: {
      name: agentName,
      firstMessage: `Hi this is ${agentName} do you have a moment?`,
      firstMessageMode: vapiIntegration?.firstMessageMode || 'assistant-speaks-first',
      backgroundSound: vapiIntegration?.backgroundSound || 'office',
      ...(vapiIntegration?.serverUrl && {
        serverUrl: vapiIntegration.serverUrl,
      }),
      transcriber: vapiIntegration?.transcriber || {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'en',
      },
      ...(vapiIntegration?.voice && {
        ...vapiIntegration.voice,
      }),
      // voice: {

      // chunkPlan belongs in voice object
      // ...(vapiIntegration?.chunkPlan && {
      //   chunkPlan: vapiIntegration.chunkPlan,
      // }),
      // ...(typeof vapiIntegration.talkingSpeed === "number" && {
      //   speed: vapiIntegration.talkingSpeed,
      // }),
      // },
      model: {
        provider: vapiIntegration?.model_configurations?.providers?.name || 'openai',
        model: vapiIntegration?.model_configurations?.model || 'gpt-4.1',
        temperature: vapiIntegration?.temperature || 0.2,
        maxTokens: vapiIntegration?.maxToken || 250,
        messages: [
          {
            role: 'system',
            // content: "You are just relaying a message to a customer.",
            content: script,
          },
        ],
        // tools and toolIds belong in model object
        ...(vapiIntegration?.tools && { tools: vapiIntegration.tools }),
        ...(vapiIntegration?.toolIds && {
          toolIds: vapiIntegration.toolIds,
        }),
      },
      endCallPhrases: vapiIntegration?.endCallPhrases || [],
      startSpeakingPlan: vapiIntegration?.startSpeakingPlan || {
        waitSeconds: 4,
        smartEndpointingEnabled: true,
      },
      stopSpeakingPlan: vapiIntegration?.stopSpeakingPlan || {
        voiceSeconds: 0.5,
        numWords: 2,
      },
      // Add missing vapi_integration fields at assistant level
      // ...(vapiIntegration?.voicemailDetection && {
      //   voicemailDetection: vapiIntegration.voicemailDetection,
      // }),
      ...(vapiIntegration?.messagePlan && {
        messagePlan: vapiIntegration.messagePlan,
      }),
      // Add JSONB fields for advanced VAPI features at assistant level
      ...(vapiIntegration?.clientMessages && {
        clientMessages: vapiIntegration.clientMessages,
      }),
      ...(vapiIntegration?.serverMessages && {
        serverMessages: vapiIntegration.serverMessages,
      }),
      serverUrl:
        'https://weiqhneguxfutfdaxsil.supabase.co/functions/v1/outbound-agent-webhook-receiver',
    },
    type: 'outboundPhoneCall',
    phoneNumberId: vapiIntegration?.phoneNumberId,
    phoneNumber: vapiIntegration?.phoneNumber,
    customer: {
      number: customerPhoneNumber,
    },
    metadata: {
      client_id: vapiIntegration?.client_id || null,
    },
  };
};

export const initiateCallUsingRecentActiveAgent = async (
  supabaseUrl: string,
  supabaseAnonKey: string, // Will be replaced with service role key
  client_id: string,
  phone_number: string,
  script: string
) => {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: agents } = await supabase
    .schema("lead_dialer")
    .from("agents")
    .select("name, id")
    .order("created_at", { ascending: false }) // newest first
    .eq("is_active", true)
    .eq("client_id", client_id)
    .eq("agent_type", "outbound")
    .limit(1);

  const agent = agents?.[0];
  if (!agent) {
    throw new Error("Agent not found");
  }

  const { data: vapiIntegration } = await supabase
    .schema("lead_dialer")
    .from("vapi_integration")
    .select("*")
    .eq("client_id", client_id)
    .eq("agent_id", agent.id)
    .single();
  if (!vapiIntegration) {
    throw new Error("VAPI integration not found");
  }

 const phoneCallPayload = convertToVapiCallPayload(phone_number, script, agent.name, vapiIntegration);

  const response = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    body: JSON.stringify(phoneCallPayload),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${vapiIntegration.auth_token}`,
    },
  }).then((res) => res.json());
  return response;
};

// TODO: to support dynamic from number and messaging_profile_id
export const sendSMS = async (
  phone_number: string,
  smsBody: string,
  telnyxApiKey: string
) => {
  const telnyxPayload = {
    // from: vapi.data.phone_number,
    from: "+61489900690",
    messaging_profile_id: "400197bf-b007-4314-9f9f-c5cd0b7b67ae",
    to: phone_number as string,
    text: smsBody,
    subject: "From LeadAI!",
    use_profile_webhooks: true,
    type: "SMS",
  };
  try {
    return await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      body: JSON.stringify(telnyxPayload),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${telnyxApiKey}`,
      },
    }).then((res) => res.json());
  } catch (smsError) {
    console.error("Failed to send Telnyx SMS:", smsError);
    return null;
  }
};

// Helper: encode email to base64url
export const createEmailRaw = (
  to: string,
  from: string,
  subject: string,
  body: string
) => {
  const message =
    `To: ${to}\r\n` +
    `From: ${from}\r\n` +
    `Subject: ${subject}\r\n\r\n` +
    body;

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// Helper: refresh token for email
export const handleRefreshToken = async (
  refreshToken: string,
  provider: string,
  microsoftClientId: string,
  microsoftClientSecret: string,
  googleClientId: string,
  googleClientSecret: string
) => {
  let newAccessToken = null;
  let newRefreshToken = null;
  let newExpiresAt = null;
  if (provider === "azure-ad") {
    console.log("microsoftClientId", microsoftClientId);
    console.log("microsoftClientSecret", microsoftClientSecret);
    console.log("refreshToken", refreshToken);
    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: microsoftClientId,
          client_secret: microsoftClientSecret,
          grant_type: "refresh_token",
          scope:
            "https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send offline_access",
        }),
      }
    ).then((res) => res.json());
    console.log("response", response);
    newAccessToken = response.access_token;
    newRefreshToken = response.refresh_token;
    const now = Math.floor(Date.now() / 1000);
    newExpiresAt = now + response.expiresIn;
  } else {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        grant_type: "refresh_token",
      }),
    }).then((res) => res.json());
    newAccessToken = response.access_token;
    newRefreshToken = response.refresh_token;
    const now = Math.floor(Date.now() / 1000);
    newExpiresAt = now + response.expiresIn;
  }

  return {
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
    expires_at: newExpiresAt,
  };
};

export async function sendOutlookMail(
  accessToken: string,
  email: string,
  emailBody: string,
  subject?: string
) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, accessToken); // use OAuth token from NextAuth
    },
  });

  await client.api("/me/sendMail").post({
    message: {
      subject: subject || "From LeadAI!",
      body: {
        contentType: "Text",
        content: emailBody,
      },
      toRecipients: [
        {
          emailAddress: {
            address: email,
          },
        },
      ],
    },
  });
  return "Email from outlook sent successfully";
}

export const sendGmail = async (
  accessToken: string,
  toEmail: string,
  fromEmail: string,
  emailBody: string,
  subject?: string
) => {
  const { google } = await import("googleapis");

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  const rawMessage = createEmailRaw(
    toEmail,
    fromEmail,
    subject || "From LeadAI!",
    emailBody
  );

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: rawMessage },
  });
  return response;
};

export const sendEmailFromStageTask = async (
  client_id: string,
  stage_email: string,
  emailBody: string,
  recipientEmail: string,
  microsoftClientId: string,
  microsoftClientSecret: string,
  googleClientId: string,
  googleClientSecret: string
) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: emailData } = await supabase
    .from("emails")
    .select("*")
    .eq("email", stage_email)
    .eq("client_id", client_id)
    .single();
  console.log("emailData", emailData);

  try {
    // Handle token refresh
    const expiresAt = emailData.expires_at * 1000; // convert to ms
    let accessToken = emailData.access_token;
    let refreshToken = emailData.refresh_token;
    if (Date.now() >= expiresAt) {
      const refreshedToken = await handleRefreshToken(
        refreshToken,
        emailData.provider,
        microsoftClientId,
        microsoftClientSecret,
        googleClientId,
        googleClientSecret
      );
      if (refreshedToken) {
        // Store the refreshed token in the database
        const now = Math.floor(Date.now() / 1000);
        await supabase
          .from("emails")
          .update({
            access_token: refreshedToken.access_token,
            refresh_token: refreshedToken.refresh_token,
            expires_at: now + refreshedToken.expires_at,
          })
          .eq("email", emailData.email)
          .eq("client_id", client_id);
        accessToken = refreshedToken.access_token;
        refreshToken = refreshedToken.refresh_token;
      }
    }
    if (emailData?.provider === "azure-ad") {
      return await sendOutlookMail(accessToken, recipientEmail, emailBody);
    } else {
      return await sendGmail(
        accessToken,
        recipientEmail,
        emailData?.email || "",
        emailBody
      );
    }
  } catch (smsError) {
    console.error("Failed to send Email:", smsError);
    return null;
  }
};
