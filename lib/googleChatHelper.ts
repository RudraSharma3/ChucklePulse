export interface ChatActionResponseOptions {
  isCardAction?: boolean; // true if triggered by button click (CARD_CLICKED)
  isAddOn?: boolean; // true for Google Workspace Add-on HTTP endpoints
}

/**
 * Formats responses to strictly comply with Google Workspace Add-on (Z Mode) specifications.
 */
export function formatChatResponse(
  payload: { cardsV2?: any[]; text?: string; title?: string },
  options: ChatActionResponseOptions = {}
) {
  const isCardAction = options.isCardAction ?? false;
  const isAddOn = options.isAddOn ?? true;
  const { cardsV2, text } = payload;

  if (isAddOn) {
    // Rule B: Mutual Exclusivity - Send ONLY cardsV2 OR text, never both at same level
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

  // Standard Google Chat API fallback
  return {
    actionResponse: { type: isCardAction ? 'UPDATE_MESSAGE' : 'NEW_MESSAGE' },
    ...(cardsV2 && cardsV2.length > 0 ? { cardsV2 } : { text: text ?? '' }),
  };
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
            imageUrl: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
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
            imageUrl: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
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
                  buttonList: {
                    buttons: [
                      {
                        text: "4.0 hrs",
                        onClick: {
                          action: {
                            function: "submitHours",
                            parameters: [{ key: "hours", value: "4.0" }]
                          }
                        }
                      },
                      {
                        text: "6.0 hrs",
                        onClick: {
                          action: {
                            function: "submitHours",
                            parameters: [{ key: "hours", value: "6.0" }]
                          }
                        }
                      },
                      {
                        text: "7.5 hrs",
                        onClick: {
                          action: {
                            function: "submitHours",
                            parameters: [{ key: "hours", value: "7.5" }]
                          }
                        }
                      },
                      {
                        text: "8.0 hrs",
                        onClick: {
                          action: {
                            function: "submitHours",
                            parameters: [{ key: "hours", value: "8.0" }]
                          }
                        }
                      }
                    ]
                  }
                },
                {
                  textParagraph: {
                    text: "<i>👉 Tap an hour button above or reply directly with any number (e.g. \"6.5h\", \"5 hours\").</i>"
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
}) {
  const blockerBadge = params.blocker === "None"
    ? "🟢 <b>Blockers:</b> None"
    : `🚨 <b>Blocker Alert:</b> ${params.blocker}`;

  const hoursText = params.hours > 0
    ? `${params.hours} hrs`
    : (params.project.includes("Awaiting") ? "0 hrs (Standby / Awaiting Tasks)" : (params.project.includes("Leave") ? "0 hrs (On Leave)" : "0 hrs (Unspecified)"));

  return {
    cardsV2: [
      {
        cardId: `confirm-${Date.now()}`,
        card: {
          header: {
            title: `✅ Standup Logged: ${params.project}`,
            subtitle: `Recorded for ${params.employeeName.split(' ')[0]} at ${params.time}`,
            imageUrl: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png",
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
  return {
    cardsV2: [
      {
        cardId: `card-${Date.now()}`,
        card: {
          header: {
            title: params.title,
            subtitle: params.subtitle ?? 'Interactive Bot Card',
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
                          function: 'handleFormSubmit',
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
