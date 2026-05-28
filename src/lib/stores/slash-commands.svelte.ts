export interface SlashCommand {
  name: string;
  description: string;
  example: string;
  handler?: ((prompt: string) => void | Promise<void>) | undefined;
}

export const slashCommands: SlashCommand[] = [
  {
    name: 'imagine',
    description: 'Generate an image from a text prompt',
    example: '/imagine a sunset over mountains',
    // The composer hook is a follow-up lane.
    handler: undefined
  }
];
