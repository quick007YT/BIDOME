import { Embed, Webhook } from "./imports/harmony.ts";

const createInstance = async () => {
	for (const gitcmd of [
		"git checkout -b music",
		"git config branch.master.remote origin",
		"git config branch.master.merge refs/heads/master",
		"git pull",
	]) {
		const git = Deno.run({
			cmd: gitcmd.split(" "),
		});

		await git.status();
	}

	return Deno.run({
		cmd: "./deno run --import-map=imports.json --config=deno.jsonc --allow-net --allow-env --allow-read --allow-write --allow-run --no-check index.ts --no-lava".split(
			" "
		),
	});
};

let webhook: Webhook | undefined = undefined;
if (Deno.env.get("WEBHOOK_URL") != undefined) {
	webhook = await Webhook.fromURL(Deno.env.get("WEBHOOK_URL") as string);
}

while (true) {
	console.log("Launching instance...");
	const instance = await createInstance();
	console.log("Instance created");
	await instance.status();
	await instance.close();
	console.log("Instance crashed! Posting webhook and restarting...");
	if (webhook != undefined) {
		webhook.send({
			embeds: [
				new Embed({
					author: {
						name: "Bidome Crash Handler",
						icon_url:
							"https://cdn.discordapp.com/avatars/778670182956531773/75fdc201ce942f628a61f9022db406dc.png?size=1024",
					},
					title: "Bidome offline!",
					description:
						"The deno process has been killed. Starting a new one...",
				}).setColor("random"),
			],
			avatar:
				"https://cdn.discordapp.com/avatars/778670182956531773/75fdc201ce942f628a61f9022db406dc.png?size=1024",
			name: "Bidome Crash Handler",
		});
	}
}
