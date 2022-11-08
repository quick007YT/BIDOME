import { ActivityType, CommandClient, StatusType } from "harmony";

export interface BotStatus {
	name: string;
	type: ActivityType;
	status?: StatusType;
}

let statusIndex = 0;

export const getRandomStatus = async (bot: CommandClient) => {
	const statuses: BotStatus[] = [
		{
			name: `!help in ${await bot.guilds.size()} servers`,
			type: "WATCHING",
		},
		{
			name: `American presindetio joe bi-`,
			type: "PLAYING",
		},
		{
			name: `!status`,
			type: "WATCHING",
		},
		{
			name: `people meme Bidome`,
			type: "WATCHING",
		},
		{
			name: "H",
			type: "PLAYING",
		}
	];

	if (statusIndex >= statuses.length) {
		statusIndex = 0;
	}

	return statuses[statusIndex];
};
