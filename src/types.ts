export interface VapiIntegration {
    firstMessageMode: string;
    backgroundSound: string;
    serverUrl: string;
    transcriber: {
      provider: string;
      model: string;
      language: string;
    };
    voice: {
      voiceId: string;
      provider: string;
      model: string;
      language: string;
    };
    chunkPlan: {
      waitSeconds: number;
      smartEndpointingEnabled: boolean;
    };
    stopSpeakingPlan: {
      voiceSeconds: number;
      numWords: number;
    };
    messagePlan: {
      waitSeconds: number;
      smartEndpointingEnabled: boolean;
    };
    clientMessages: {
      message: string;
      waitSeconds: number;
    }[];
    serverMessages: {
      message: string;
      waitSeconds: number;
    }[];
    phoneNumberId: string;
    phoneNumber: string;
    client_id: string;
    model_configurations: {
      providers: {
        name: string;
      };
      model: string;
    };
    tools: {
      name: string;
      description: string;
    }[];
    toolIds: string[];
    endCallPhrases: string[];
    startSpeakingPlan: {
      waitSeconds: number;
      smartEndpointingEnabled: boolean;
    };
    temperature: number;
    maxToken: number;
    auth_token: string;
  }