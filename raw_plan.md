Matcha: Match with agent 

An app for the people want to match the resources from the government, also the government want to find the people for their resources.

Components:

A central channel with categories user to submit their update, and government agent will look up if the user's persona match, then the government agent would send message to the user agent for connection.
Possibly using firebase

Two main side:

User side (2 agent):

Persona Agent for building user personal by asking questions and binary questions with left swipe and right swipe. it will broadcast the user's persona once the agent thinks new information needs to be seen.

Coffee chat by finding other user agent for connection, want to see if ze has some information can share (possibly similar persona people can match)

Government agent has their own data, it has RAG or other useful tools for checking their data. It will lookup for update in the channel. It will connect to user agent if think match.

Use claude managed agent (https://platform.claude.com/docs/en/managed-agents/overview) for agent. All user share same persona and coffee agent, the two agent has different skill, but same type of agent use for all people, different people use different environment (but idk how about session, you can give me a plan)

For government agent, each government office or resources has its own agent and skill.

For each pair of agents communicating (user - government and user - user), both side would have a dashboard of matching possibe rate and choose to manualy drop or real person join (the other side also get notice).

For each side, if possible match, the agent would decide and send a notification.

The government side should have a dashboard of matching rate / count, manual join rate / count, user-need distribution, user-metadata distribution.

For government side, they can submit their data in a zip, and the agent would decide what tools to use on these, and generate the corresponding skill. 


For user-side, they have a chat conversation to build persona, quick left/right swipe for more big orienation choose, notification, coffee chat / government chat / personal profile.

