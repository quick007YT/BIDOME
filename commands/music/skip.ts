import { Command, CommandContext, Embed } from "harmony";
import { queues, doPermCheck } from "queue";

export default class Skip extends Command {
	name = "skip";
	aliases = ["s"];
	category = "music";
	description = "Vote to skip the queue";

	async execute(ctx: CommandContext) {
		if (ctx.guild == undefined) return;
		const queue = queues.get(ctx.guild.id);
		if (queue == undefined) {
			await ctx.message.reply(undefined, {
				embeds: [
					new Embed({
						author: {
							name: "Bidome bot",
							icon_url: ctx.client.user!.avatarURL(),
						},
						title: "Not currently playing!",
						description: "I am not currently playing anything!",
					}).setColor("red"),
				],
			});
		} else {
			const queue = queues.get(ctx.guild!.id)!;
			const states = await ctx.guild!.voiceStates.get(ctx.author.id);
			const doesUserNeedToBeAdded = !queue.voteSkipUsers.includes(ctx.author.id);

			if (doesUserNeedToBeAdded) {
				queue.voteSkipUsers.push(ctx.author.id);
			}

			const canVoteSkip = queue.canSkip(
				(await states!.channel!.voiceStates.array()).filter((s) => !s.user.bot)
			);

			if (canVoteSkip) {
				const isSongLoop = !!queue.songLoop;
				const isQueueLoop = !!queue.queueLoop;

				queue.songLoop = false;
				queue.queueLoop = false;

				queue.player.seek(queue.queue[0].msLength - 100);

				await ctx.message.reply({
					embeds: [
						new Embed({
							author: {
								name: "Bidome bot",
								icon_url: ctx.client.user!.avatarURL(),
							},
							title: "Skipped",
							description:
								"Enough users have voted so the song has been skipped!",
						}).setColor("green"),
					],
				});

				// Reset the loop settings
				queue.songLoop = isSongLoop;
				queue.queueLoop = isQueueLoop;
			} else {
				const voiceMembers = (
					await states!.channel!.voiceStates.array()
				).filter((s) => !s.user.bot);
				const skippingUsers = [];

				for (const member of voiceMembers) {
					if (queue.voteSkipUsers.includes(member.user.id)) {
						skippingUsers.push(member.user.id);
					}
				}

				if (doesUserNeedToBeAdded) {
					await ctx.message.reply({
						embeds: [
							new Embed({
								author: {
									name: "Bidome bot",
									icon_url: ctx.client.user!.avatarURL(),
								},
								title: "Voted to skip",
								description: `You have voted to skip the song! ${
									skippingUsers.length
								}/${Math.floor(voiceMembers.length / 2) + 1}`,
								footer: {
									text: (await doPermCheck(ctx.member!, states!.channel!))
										? "Use forceskip to skip without a vote"
										: "",
								},
							}).setColor("green"),
						],
					});
				} else {
					await ctx.message.reply({
						embeds: [
							new Embed({
								author: {
									name: "Bidome bot",
									icon_url: ctx.client.user!.avatarURL(),
								},
								title: "Already voted to skip",
								description: `You have already voted to skip the song! ${
									skippingUsers.length
								}/${Math.floor(voiceMembers.length / 2) + 1}`,
								footer: {
									text: (await doPermCheck(ctx.member!, states!.channel!))
										? "Use forceskip to skip without a vote"
										: "",
								},
							}).setColor("red"),
						],
					});
				}
			}
		}
	}
}