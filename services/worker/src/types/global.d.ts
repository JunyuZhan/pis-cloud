// Global type declarations for optional dependencies

declare module 'nodemailer' {
  export interface Transport {
    sendMail(mail: unknown): Promise<unknown>;
  }
  export interface TransportOptions {
    host: string;
    port: number;
    secure?: boolean;
    auth: {
      user: string;
      pass: string;
    };
  }
  export function createTransport(options: TransportOptions): Transport;
}
