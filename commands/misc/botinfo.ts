import { Command, CommandContext, Embed } from "harmony";

export class command extends Command {
	name = "botinfo";
	category = "misc";
	aliases = ["botstats", "info"];
	description = "Get bot information";
	usage = "Botinfo";
	async execute(ctx: CommandContext) {
		const data = {
			servers: 0,
			roles: 0,
			channels: 0,
			humans: 0,
			bots: 0,
			accounts: 0,
		};

		for (const guild of await ctx.message.client.guilds.array()) {
			data.accounts += guild.memberCount ?? 1;
			data.servers++;
			data.roles += await guild.roles.size();
			data.channels += await guild.channels.size();
			data.humans += await (
				await guild.members.fetchList()
			).filter((m) => !m.user.bot).length;
			data.bots += await (
				await guild.members.fetchList()
			).filter((m) => m.user.bot).length;
		}

		const isCachedUsers = data.accounts != data.humans + data.bots;

		await ctx.message.reply(undefined, {
			embed: new Embed({
				author: {
					name: "Bidome bot",
					icon_url: ctx.message.client.user?.avatarURL(),
				},
				fields: [
					{
						name: "Servers",
						value: `\`${data.servers}\``,
						inline: true,
					},
					{
						name: "Accounts",
						value: `\`${data.accounts}\``,
						inline: true,
					},
					{
						name: "Roles",
						value: `\`${data.roles}\``,
						inline: true,
					},
					{
						name: "Channels",
						value: `\`${data.channels}\``,
						inline: true,
					},
					{
						name: `Humans${isCachedUsers ? "*" : ""}`,
						value: `\`${data.humans}\``,
						inline: true,
					},
					{
						name: `Bots${isCachedUsers ? "*" : ""}`,
						value: `\`${data.bots}\``,
						inline: true,
					},
					{
						name: "Developers",
						value: "```yml\n- Blocks_n_more\n- Lukas```",
						inline: true,
					},
					{
						name: "Library",
						value: "[Harmony](https://deno.land/x/harmony)",
						inline: true,
					},
					{
						name: "Source code",
						value: "[Github](https://github.com/quick007/bidome)",
						inline: true,
					},
				],
				footer: {
					text: `${isCachedUsers ? `* Cached users` : ""}`,
				},
			}).setColor("random"),
		});
	}
}