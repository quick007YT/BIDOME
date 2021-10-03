import {
	Extension,
	CommandContext,
	Embed,
	Gateway,
	command,
	CommandClient as CmdClient,
	MessageComponentData,
	isMessageComponentInteraction,
} from 'harmony';
import { Cluster, UpdateVoiceStatus } from 'lavadeno';
import { removeDiscordFormatting, formatMs } from 'tools';
import { Queue, Song } from 'queue';

var lavalink: Cluster;
const queue: Map<string, Queue> = new Map();

export class extension extends Extension {
	constructor(bot: CmdClient) {
		super(bot);

		const sendGatewayPayload = (id: bigint, payload: UpdateVoiceStatus) => {
			const shardID = Number(
				(BigInt(id) << 22n) %
					BigInt(this.client.shards.cachedShardCount ?? 1)
			);
			const shard = this.client.shards.get(shardID) as Gateway;
			// @ts-ignore stop errors
			shard.send(payload);
		};

		lavalink = new Cluster({
			nodes: [
				{
					host: '127.0.0.1',
					port: 2333,
					password: 'youshallnotpass',
					id: '1',
					reconnect: {
						type: 'basic',
						tries: -1,
						delay: 5 * 1000,
					},
				},
			],
			sendGatewayPayload,
		});

		lavalink.on('nodeConnect', (node, took, reconnect) => {
			console.log(
				`[Lavalink]: Node ${
					node.id
				} Connected! Took: ${took}ms Auto-Reconnect: ${
					reconnect ? 'Yes' : 'No'
				}`
			);
		});

		lavalink.on('nodeError', (node, error) => {
			console.log(`[Lavalink]: Node ${node.id} had an error!\n`, error);
		});

		lavalink.on('nodeDisconnect', (node, code, reason) => {
			console.log(
				`[Lavalink]: Node ${
					node.id
				} disconnected! Code: ${code} Reason: ${
					reason ?? 'No reason given'
				}`
			);
		});

		this.client.on('raw', (evt: string, d: unknown) => {
			switch (evt) {
				case 'VOICE_SERVER_UPDATE':
				case 'VOICE_STATE_UPDATE':
					// @ts-expect-error Typings
					lavalink.handleVoiceUpdate(d);
			}
		});

		lavalink.init(BigInt(this.client.user?.id as string));
	}

	@command({
		aliases: ['summon'],
		category: 'music',
	})
	async join(ctx: CommandContext) {
		if (!ctx.guild || !ctx.guild.id) return;
		const vc = await ctx.guild.voiceStates.get(ctx.author.id);

		if (!vc) {
			await ctx.message.reply(undefined, {
				embed: new Embed({
					author: {
						name: 'Bidome bot',
						icon_url: ctx.client.user?.avatarURL(),
					},
					title: 'Music',
					description: 'Please join a music channel!',
				}).setColor('random'),
			});
		} else {
			if (
				queue.has(ctx.guild.id) &&
				queue.get(ctx.guild.id)?.player.connected
			) {
				await ctx.message.reply(undefined, {
					embed: new Embed({
						author: {
							name: 'Bidome bot',
							icon_url: ctx.client.user?.avatarURL(),
						},
						title: 'Music',
						description:
							'I am already connected to another channel!',
					}).setColor('random'),
				});
			} else {
				if (queue.has(ctx.guild.id)) {
					queue.get(ctx.guild.id)?.player.destroy();
				}

				const serverQueue = await new Queue(
					lavalink,
					vc.channel?.id as string,
					ctx.author.id,
					ctx.guild?.id as string,
					ctx.client,
					queue
				);
				serverQueue.deleteQueue();

				await ctx.message.reply(undefined, {
					embed: new Embed({
						author: {
							name: 'Bidome bot',
							icon_url: ctx.client.user?.avatarURL(),
						},
						title: 'Music',
						description: `Joined **${removeDiscordFormatting(
							vc.channel?.name as string
						)}**`,
					}).setColor('random'),
				});
			}
		}
	}

	@command({
		aliases: ['enqueue', 'p'],
		category: 'music',
	})
	async play(ctx: CommandContext) {
		if (!ctx.guild || !ctx.guild.id) return;
		if (ctx.argString == '') {
			await ctx.message.reply(undefined, {
				embed: new Embed({
					author: {
						name: 'Bidome bot',
						icon_url: ctx.client.user?.avatarURL(),
					},
					title: 'Music',
					description: 'Please provide a search query!',
				}).setColor('random'),
			});
		} else {
			const vc = await ctx.guild.voiceStates.get(ctx.author.id);

			if (!vc) {
				await ctx.message.reply(undefined, {
					embed: new Embed({
						author: {
							name: 'Bidome bot',
							icon_url: ctx.client.user?.avatarURL(),
						},
						title: 'Music',
						description: 'Please join a music channel!',
					}).setColor('random'),
				});
			} else {
				if (
					queue.has(ctx.guild.id) &&
					queue.get(ctx.guild.id)?.channel != vc.channel?.id
				) {
					await ctx.message.reply(undefined, {
						embed: new Embed({
							author: {
								name: 'Bidome bot',
								icon_url: ctx.client.user?.avatarURL(),
							},
							title: 'Music',
							description:
								'I am currently playing in another channel!',
						}).setColor('random'),
					});
				} else {
					const message = await ctx.message.reply(undefined, {
						embed: new Embed({
							author: {
								name: 'Bidome bot',
								icon_url: ctx.client.user?.avatarURL(),
							},
							title: 'Music',
							description:
								'<a:typing:779775412829028373> Finding track',
						}).setColor('random'),
					});

					const isURL = /(((http|https):\/\/)|www.)/i.test(
						ctx.argString
					);

					const searchPrompt = isURL
						? ctx.argString
						: `ytsearch:${ctx.argString}`;

					const { tracks } = await lavalink.rest.loadTracks(
						searchPrompt
					);
					if (tracks.length < 1) {
						message.edit(
							new Embed({
								author: {
									name: 'Bidome bot',
									icon_url: ctx.client.user?.avatarURL(),
								},
								title: 'Music',
								description:
									'❗ Unable to find a track with that name',
							}).setColor('random')
						);
					} else {
						const getImageFromURI = (
							_uri: string
						): string | null => {
							return null;
						};

						const track = tracks[0].info;
						let song: Song = {
							requestedBy: ctx.author.id,
							name: track.title,
							author: track.author,
							image: getImageFromURI(track.uri),
							url: track.uri,
							msLength: track.length,
							track: tracks[0].track,
						};
						if (!isURL) {
							const now = Date.now();
							const buttons: MessageComponentData[] = [];
							let options = '';
							for (
								let i = 0;
								i < (tracks.length < 5 ? tracks.length : 5);
								i++
							) {
								const track = tracks[i];
								buttons.push({
									type: 2,
									label: `#${i + 1}`,
									customID: `${now}-${i}`,
									style: 'BLURPLE',
								});
								options += `\n\`#${
									i + 1
								}\` - [${removeDiscordFormatting(
									track.info.title.length > 197
										? `${track.info.title.substring(
												0,
												track.info.title.length - 3
										  )}...`
										: track.info.title
								)}](${track.info.uri})`;
							}
							await message.edit({
								embed: new Embed({
									author: {
										name: 'Bidome bot',
										icon_url: ctx.client.user?.avatarURL(),
									},
									title: 'Music',
									description: options,
									footer: {
										text: 'This will expire in 30 seconds!',
									},
								}).setColor('random'),
								components: [
									{
										type: 1,
										components: buttons,
									},
									{
										type: 1,
										components: [
											{
												type: 2,
												style: 'RED',
												label: 'Cancel',
												customID: `${now}-cancel`,
											},
										],
									},
								],
							});
							const [response] = await ctx.client.waitFor(
								'interactionCreate',
								(i) =>
									i.user.id == ctx.author.id &&
									isMessageComponentInteraction(i) &&
									i.customID.startsWith(`${now}-`),
								30 * 1000
							);
							if (!response) {
								message.edit({
									embed: new Embed({
										author: {
											name: 'Bidome bot',
											icon_url:
												ctx.client.user?.avatarURL(),
										},
										title: 'Music',
										description: 'Selection timed out',
									}).setColor('random'),
									components: [],
								});
								return;
							} else {
								if (!isMessageComponentInteraction(response))
									return;
								if (response.customID == `${now}-cancel`) {
									message.edit({
										embed: new Embed({
											author: {
												name: 'Bidome bot',
												icon_url:
													ctx.client.user?.avatarURL(),
											},
											title: 'Music',
											description: 'Canceled selection',
										}).setColor('random'),
										components: [],
									});
									return;
								} else {
									const trackInfo =
										tracks[
											parseInt(
												response.customID.substring(
													`${now}-`.length
												)
											)
										];
									const track = trackInfo.info;
									song = {
										requestedBy: ctx.author.id,
										name: track.title,
										author: track.author,
										image: getImageFromURI(track.uri),
										url: track.uri,
										msLength: track.length,
										track: trackInfo.track,
									};
								}
							}
						}
						if (!queue.has(ctx.guild.id)) {
							queue.set(
								ctx.guild.id,
								new Queue(
									lavalink,
									vc.channel?.id as string,
									ctx.author.id,
									ctx.guild.id,
									ctx.client,
									queue,
									message
								)
							);
						}
						const serverQueue: Queue = queue.get(
							ctx.guild.id
						) as Queue;
						if (serverQueue.queue.length > 0) {
							message.edit({
								embed: new Embed({
									author: {
										name: 'Bidome bot',
										icon_url: ctx.client.user?.avatarURL(),
									},
									title: 'Added song to queue',
									fields: [
										{
											name: 'Song',
											value: `\`${(song.name.length > 197
												? `${song.name.substring(
														0,
														197
												  )}...`
												: song.name
											)
												.replace(/`/gi, '\\`')
												.replace(/\\/, '\\')}\``,
											inline: true,
										},
										{
											name: 'Author',
											value: `${removeDiscordFormatting(
												song.author
											)}`,
											inline: true,
										},
										{
											name: 'Length',
											value: `${formatMs(song.msLength)}`,
											inline: true,
										},
										{
											name: 'Position',
											value: `${
												serverQueue.queue.length + 1
											}`,
											inline: true,
										},
									],
									thumbnail: {
										url: song.image ?? undefined,
									},
								}).setColor('random'),
								components: [],
							});
						}
						serverQueue.addSong(song);
					}
				}
			}
		}
	}

	@command({
		aliases: ['q', 'serverqueue'],
		category: 'music',
	})
	async queue(ctx: CommandContext) {
		if (!ctx.guild || !ctx.guild.id) return;
		if (!queue.has(ctx.guild.id)) {
			await ctx.message.reply(undefined, {
				embed: new Embed({
					author: {
						name: 'Bidome bot',
						icon_url: ctx.client.user?.avatarURL(),
					},
					title: 'Music',
					description: 'I am not currently playing anything!',
				}).setColor('random'),
			});
		} else {
			const songs = (queue.get(ctx.guild.id) as Queue).queue;
			const info: { pos: number; song: Song }[] = [];
			for (let i = 0; i < (songs.length < 5 ? songs.length : 5); i++) {
				info.push({ pos: i, song: songs[i] });
			}
			await ctx.message.reply(undefined, {
				embed: new Embed({
					author: {
						name: 'Bidome bot',
						icon_url: ctx.client.user?.avatarURL(),
					},
					title: 'Up next',
					description: info
						.map(
							({ pos, song }) =>
								`\`${
									pos == 0 ? 'Now playing' : `#${pos + 1}`
								}\` - **${(song.name.length > 197
									? `${song.name.substring(0, 197)}...`
									: song.name
								)
									.replace(/`/gi, '\\`')
									.replace(/\\/, '\\')}** (${formatMs(
									song.msLength
								)})`
						)
						.join('\n'),
				}).setColor('random'),
			});
		}
	}

	@command({
		aliases: ['np'],
		category: 'music',
	})
	async nowplaying(ctx: CommandContext) {
		if (!ctx.guild || !ctx.guild.id) return;
		if (!queue.has(ctx.guild.id)) {
			await ctx.message.reply(undefined, {
				embed: new Embed({
					author: {
						name: 'Bidome bot',
						icon_url: ctx.client.user?.avatarURL(),
					},
					title: 'Music',
					description: 'I am not currently playing anything!',
				}).setColor('random'),
			});
		} else {
			const song = (queue.get(ctx.guild.id) as Queue).queue[0];
			ctx.message.reply(undefined, {
				embed: new Embed({
					author: {
						name: 'Bidome bot',
						icon_url: ctx.client.user?.avatarURL(),
					},
					title: 'Playing song',
					fields: [
						{
							name: 'Song',
							value: `\`${(song.name.length > 197
								? `${song.name.substring(0, 197)}...`
								: song.name
							)
								.replace(/`/gi, '\\`')
								.replace(/\\/, '\\')}\``,
							inline: true,
						},
						{
							name: 'Author',
							value: `${removeDiscordFormatting(song.author)}`,
							inline: true,
						},
						{
							name: 'Length',
							value: `${formatMs(song.msLength)}`,
							inline: true,
						},
					],
					thumbnail: {
						url: song.image ?? undefined,
					},
				}).setColor('random'),
			});
		}
	}

	@command({
		aliases: ['dc'],
		category: 'music',
	})
	async disconnect(ctx: CommandContext) {
		if (!ctx.guild || !ctx.guild.id) return;
		if (!queue.has(ctx.guild.id)) {
			await ctx.message.reply(undefined, {
				embed: new Embed({
					author: {
						name: 'Bidome bot',
						icon_url: ctx.client.user?.avatarURL(),
					},
					title: 'Music',
					description: 'I am not currently playing anything!',
				}).setColor('random'),
			});
		} else {
			const vc = await ctx.guild.voiceStates.get(ctx.author.id);
			const botvc = await ctx.guild.voiceStates.get(
				ctx.client.user?.id as string
			);
			if (!botvc) {
				await ctx.message.reply(undefined, {
					embed: new Embed({
						author: {
							name: 'Bidome bot',
							icon_url: ctx.client.user?.avatarURL(),
						},
						title: 'Music',
						description:
							'I am not currently connected to a channel!',
					}).setColor('random'),
				});
			} else {
				if (!vc || botvc.channel?.id != vc.channel?.id) {
					await ctx.message.reply(undefined, {
						embed: new Embed({
							author: {
								name: 'Bidome bot',
								icon_url: ctx.client.user?.avatarURL(),
							},
							title: 'Music',
							description:
								'You are not currently connected to my channel!',
						}).setColor('random'),
					});
				} else {
					if (
						((await vc.channel?.voiceStates.array()) ?? []).length >
							2 &&
						!ctx.member?.permissions.has('ADMINISTRATOR')
					) {
						await ctx.message.reply(undefined, {
							embed: new Embed({
								author: {
									name: 'Bidome bot',
									icon_url: ctx.client.user?.avatarURL(),
								},
								title: 'Music',
								description:
									'You are missing the permission `ADMINISTRATOR`! (Being alone also works)',
							}).setColor('random'),
						});
					} else {
						const serverQueue: Queue = queue.get(
							ctx.guild.id
						) as Queue;
						serverQueue.player.disconnect();
						serverQueue.deleteQueue();
						await ctx.message.reply(undefined, {
							embed: new Embed({
								author: {
									name: 'Bidome bot',
									icon_url: ctx.client.user?.avatarURL(),
								},
								title: 'Music',
								description: 'I have left your channel!',
							}).setColor('random'),
						});
					}
				}
			}
		}
	}
}