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

export function getLocalHour(date: Date = new Date()): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false
  }).format(date);
  return parseInt(hourStr, 10);
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
  const endpointUrl = getBotEndpointUrl();

  return {
    cardsV2: [
      {
        cardId: `hours-prompt-${Date.now()}`,
        card: {
          header: {
            title: "⏱️ Hours Required",
            subtitle: `Thanks for the update, ${params.userName}! How many hours will this take?`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `📝 <b>Planned Tasks:</b> ${params.tasks}`
                  }
                },
                {
                  textParagraph: {
                    text: `📁 <b>Project:</b> ${params.project}`
                  }
                },
                {
                  textParagraph: {
                    text: `👉 <b>Tap your planned hours below or reply in chat with the number of hours</b> (e.g. <i>"8 hours"</i>, <i>"7h"</i>, <i>"6h"</i>):`
                  }
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: "8 hrs (Full Day)",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "8.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "7 hrs",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "7.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "6 hrs",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "6.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "5 hrs",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "5.0" }
                            ]
                          }
                        }
                      },
                      {
                        text: "4 hrs (Half Day)",
                        onClick: {
                          action: {
                            function: endpointUrl,
                            parameters: [
                              { key: "actionName", value: "submitHours" },
                              { key: "hours", value: "4.0" }
                            ]
                          }
                        }
                      }
                    ]
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
  availableHours?: number;
}) {
  const logged = params.loggedHours;
  const avail = params.availableHours || 0;
  const totalAccounted = +(logged + avail).toFixed(1);
  const rem = params.remainingHours;

  const hasSpecificProject = Boolean(
    params.project &&
    params.project.trim() !== '' &&
    params.project.toLowerCase() !== 'general tasks' &&
    params.project.toLowerCase() !== 'general'
  );

  const cleanProject = hasSpecificProject ? params.project!.trim() : '';
  const cleanTasks = (params.tasks && params.tasks.toLowerCase() !== 'general tasks' && params.tasks.toLowerCase() !== 'general') ? params.tasks.trim() : '';

  const headerSubtitle = avail > 0
    ? `Logged ${logged} hrs work + ${avail} hrs available (${totalAccounted} / 8.0 hrs)`
    : (cleanProject ? `Logged ${logged} hrs on ${cleanProject}` : `${logged} hours logged so far`);

  const loggedText = avail > 0
    ? `📝 <b>Logged so far:</b> ${logged} hrs work${cleanProject ? ` on <b>${cleanProject}</b>` : ''}${cleanTasks && cleanTasks !== cleanProject ? ` (${cleanTasks})` : ''} + <b>${avail} hrs available</b> (Standby).`
    : (cleanProject
      ? `📝 <b>Logged so far:</b> ${logged} hrs on <b>${cleanProject}</b>${cleanTasks && cleanTasks !== cleanProject ? ` (${cleanTasks})` : ''}`
      : `📝 <b>Logged so far:</b> ${logged} hrs${cleanTasks ? ` (${cleanTasks})` : ''}`);

  return {
    cardsV2: [
      {
        cardId: `capacity-${Date.now()}`,
        card: {
          header: {
            title: `⏰ Daily Capacity Check (${totalAccounted} / 8.0 hrs)`,
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
 * Builds an Invalid Task Entry / Non-Work Activity Notice Card
 */
export function buildNonWorkActivityCard(params: {
  userName: string;
  inputPhrase: string;
}) {
  return {
    text: `⚠️ *Invalid Task Entry: "${params.inputPhrase}"*\n❌ Personal activities cannot be logged as company work tasks.\n\n👉 *If you worked on company tasks:* Please reply with your actual project & tasks (e.g. "3h on feature development" or "3h on testing").\n🏖️ *If you took time off or left early:* Reply with "half day leave" or "personal leave".\n⏳ *If you had no tasks assigned:* Reply with "awaiting tasks".`,
    cardsV2: [
      {
        cardId: `nonwork-${Date.now()}`,
        card: {
          header: {
            title: `⚠️ Invalid Task Entry: "${params.inputPhrase}"`,
            subtitle: `Personal activities cannot be logged as company work tasks`,
            imageUrl: BOT_ICON_URL,
            imageType: "CIRCLE"
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: `❌ <b>"${params.inputPhrase}"</b> is not recognized as an active company project task or initiative.`
                  }
                },
                {
                  textParagraph: {
                    text: `👉 <b>If you worked on company tasks:</b> Please reply with your actual project & tasks (e.g. <i>"1h on bug fixes"</i> or <i>"1h on documentation"</i>).`
                  }
                },
                {
                  textParagraph: {
                    text: `🏖️ <b>If you took time off or left early:</b> Reply with <i>"half day leave"</i> or <i>"personal leave"</i>.`
                  }
                },
                {
                  textParagraph: {
                    text: `⏳ <b>If you had no tasks assigned:</b> Reply with <i>"awaiting tasks"</i>.`
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
  date?: string;
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

  const displayDate = params.date || formatLocalDate(new Date());

  const subtitle = params.isUpdate
    ? `Updated for ${params.employeeName.split(' ')[0]} on ${displayDate} at ${params.time}`
    : `Recorded for ${params.employeeName.split(' ')[0]} on ${displayDate} at ${params.time}`;

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
                    text: `📅 <b>Recorded:</b> ${displayDate} &nbsp;•&nbsp; ⏱️ <b>Time:</b> ${params.time}`
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
