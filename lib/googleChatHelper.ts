export interface ChatActionResponseOptions {
  isCardAction?: boolean; // true if triggered by button click (CARD_CLICKED)
  isAddOn?: boolean; // true for Google Workspace Add-on HTTP endpoints
}

const BOT_ICON_URL = "https://ssl.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";

/**
 * Formats responses to strictly comply with Google Workspace Add-on (Z Mode) specifications.
 */
export function formatChatResponse(
  payload: { cardsV2?: any[]; text?: string; title?: string },
  options: ChatActionResponseOptions = {}
) {
  const isCardAction = options.isCardAction ?? false;
  const { cardsV2, text } = payload;

  const message = cardsV2 && cardsV2.length > 0
    ? { cardsV2 }
    : { text: text ?? (isCardAction ? 'Action completed.' : 'Message received.') };

  return {
    hostAppDataAction: {
      chatDataAction: isCardAction
        ? { updateMessageAction: { message } }
        : { createMessageAction: { message } },
    },
  };
}

export function getBotEndpointUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const base = process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
    return base.endsWith('/api/chat/google') ? base : `${base}/api/chat/google`;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api/chat/google`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/chat/google`;
  }
  return "https://chuckle-pulse.vercel.app/api/chat/google";
}

export function formatLocalTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    hour12: true
  });
}

export function formatLocalDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Builds an interactive Standup Prompt Card v2
 */
export function buildStandupPromptCard(params: {
  userName: string;
  prompt: string;
}) {
  return {
    cardsV2: [
      {
        cardId: `prompt-${Date.now()}`,
        card: {
          header: {
            title: "⏰ BytePx Daily Standup",
            subtitle: `Good morning ${params.userName}! Time to share today's mission.`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `<b>${params.prompt}</b>`
                  }
                },
                {
                  textParagraph: {
                    text: "<i>👉 Reply directly with your project, planned tasks, hours, and blockers!</i>"
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds an interactive Hours Prompt Card when an employee submitted tasks without hours
 */
export function buildHoursRequestCard(params: {
  userName: string;
  tasks: string;
  project: string;
}) {
  return {
    cardsV2: [
      {
        cardId: `hours-prompt-${Date.now()}`,
        card: {
          header: {
            title: "⏱️ Hours Required",
            subtitle: `Awesome update, ${params.userName}! How many hours for today?`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `📝 <b>Tasks Recorded:</b> ${params.tasks}`
                  }
                },
                {
                  textParagraph: {
                    text: `📁 <b>Initiative:</b> ${params.project}`
                  }
                },
                {
                  textParagraph: {
                    text: `👉 <b>Please reply directly with the number of hours you are allocating for these tasks today</b> (e.g. "8 hours", "6h", or "7.5 hrs").`
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds a clean Capacity Check Card when an employee logs fewer than 8 hours, prompting manual entry for the rest
 */
export function buildRemainingHoursCard(params: {
  userName: string;
  project?: string;
  tasks?: string;
  loggedHours: number;
  remainingHours: number;
}) {
  const logged = params.loggedHours;
  const rem = params.remainingHours;

  const hasSpecificProject = Boolean(
    params.project &&
    params.project.trim() !== '' &&
    params.project.toLowerCase() !== 'general tasks' &&
    params.project.toLowerCase() !== 'general'
  );

  const cleanProject = hasSpecificProject ? params.project!.trim() : '';
  const cleanTasks = (params.tasks && params.tasks.toLowerCase() !== 'general tasks' && params.tasks.toLowerCase() !== 'general') ? params.tasks.trim() : '';

  const headerSubtitle = cleanProject
    ? `Logged ${logged} hrs on ${cleanProject}`
    : `${logged} hours logged so far`;

  const loggedText = cleanProject
    ? `📝 <b>Logged so far:</b> ${logged} hrs on <b>${cleanProject}</b>${cleanTasks && cleanTasks !== cleanProject ? ` (${cleanTasks})` : ''}`
    : `📝 <b>Logged so far:</b> ${logged} hrs${cleanTasks ? ` (${cleanTasks})` : ''}`;

  return {
    cardsV2: [
      {
        cardId: `capacity-${Date.now()}`,
        card: {
          header: {
            title: `⏰ Daily Capacity Check (${logged} / 8.0 hrs)`,
            subtitle: headerSubtitle,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: loggedText
                  }
                },
                {
                  textParagraph: {
                    text: `💡 <i>Our workday is 8.0 hrs (9h office shift - 1h lunch).</i>`
                  }
                },
                {
                  textParagraph: {
                    text: `👉 <b>Please reply directly in chat with what tasks you are doing for the remaining ${rem} hours.</b><br><br><i>Example: "${rem} hours on bug fixes and documentation" or "${rem}h on feature testing"</i>`
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds an interactive Standup Confirmation Card v2
 */
export function buildStandupConfirmationCard(params: {
  employeeName: string;
  project: string;
  tasks: string;
  hours: number;
  blocker: string;
  time: string;
  isUpdate?: boolean;
}) {
  const blockerBadge = params.blocker === "None"
    ? "🟢 <b>Blockers:</b> None"
    : `🚨 <b>Blocker Alert:</b> ${params.blocker}`;

  const hoursText = params.hours > 0
    ? `${params.hours} hrs`
    : (params.project.includes("Awaiting") ? "0 hrs (Standby / Awaiting Tasks)" : (params.project.includes("Leave") ? "0 hrs (On Leave)" : "0 hrs (Unspecified)"));

  const cardTitle = params.isUpdate
    ? `🔄 Standup Updated: ${params.project}`
    : `✅ Standup Logged: ${params.project}`;

  const subtitle = params.isUpdate
    ? `Updated for ${params.employeeName.split(' ')[0]} at ${params.time}`
    : `Recorded for ${params.employeeName.split(' ')[0]} at ${params.time}`;

  return {
    cardsV2: [
      {
        cardId: `confirm-${Date.now()}`,
        card: {
          header: {
            title: cardTitle,
            subtitle: subtitle,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `📁 <b>Project:</b> ${params.project}`
                  }
                },
                {
                  textParagraph: {
                    text: `📝 <b>Tasks:</b> ${params.tasks}`
                  }
                },
                {
                  textParagraph: {
                    text: `⏱️ <b>Hours:</b> ${hoursText}`
                  }
                },
                {
                  textParagraph: {
                    text: blockerBadge
                  }
                },
                {
                  textParagraph: {
                    text: `💡 <i>Need to adjust? Simply reply with updated tasks & hours anytime today to override!</i>`
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Builds an interactive task review card with action buttons
 */
export function buildInteractiveCard(params: {
  title: string;
  subtitle?: string;
  items: Array<{ id: string; title: string; description: string }>;
}) {
  const endpointUrl = getBotEndpointUrl();

  return {
    cardsV2: [
      {
        cardId: `card-${Date.now()}`,
        card: {
          header: {
            title: params.title,
            subtitle: params.subtitle ?? 'Interactive Bot Card',
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: params.items.map((item) => ({
            header: item.title,
            widgets: [
              {
                textParagraph: {
                  text: item.description,
                },
              },
              {
                textInput: {
                  name: `input_${item.id}`,
                  label: 'Enter your response / hours',
                  type: 'SINGLE_LINE',
                },
              },
              {
                buttonList: {
                  buttons: [
                    {
                      text: 'Submit Update',
                      onClick: {
                        action: {
                          function: endpointUrl,
                          parameters: [
                            { key: 'actionName', value: 'handleFormSubmit' },
                            { key: 'itemId', value: item.id },
                            { key: 'inputFieldName', value: `input_${item.id}` },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            ],
          })),
        },
      },
    ],
  };
}

/**
 * Confirmation success card returned in-place after button submission.
 */
export function buildSuccessCard(message: string) {
  return {
    cardsV2: [
      {
        cardId: `success-${Date.now()}`,
        card: {
          header: {
            title: '✅ Update Received',
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: message,
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}
