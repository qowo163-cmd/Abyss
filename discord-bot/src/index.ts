import "dotenv/config";
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const API = (process.env.ABYSS_API_URL || "https://abyss-production-d838.up.railway.app").replace(/\/$/, "");
const SECRET = process.env.DISCORD_INTERNAL_SECRET!;
if (!TOKEN || !CLIENT_ID || !SECRET) throw new Error("DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_INTERNAL_SECRET가 필요합니다.");

async function api(path:string, init:RequestInit={}) {
  const response=await fetch(`${API}${path}`, { ...init, headers:{ "Content-Type":"application/json", "x-abyss-discord-secret":SECRET, ...(init.headers||{}) } });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || data.message || "Abyss API 오류");
  return data;
}
async function linked(interaction:ChatInputCommandInteraction) {
  const data=await api(`/api/internal/discord/link/by-user/${interaction.user.id}`, { method:"GET" });
  if(!data.member) throw new Error("먼저 /link 명령어로 Abyss 계정을 연동해 주세요.");
  return data.member;
}
async function monster(name:string) {
  const data=await api(`/api/internal/discord/monsters?query=${encodeURIComponent(name)}`, { method:"GET" });
  const list=data.monsters||[];
  if(!list.length) throw new Error(`헨치를 찾지 못했습니다: ${name}`);
  if(list.length>1 && String(list[0].name).toLowerCase()!==name.toLowerCase()) throw new Error(`헨치가 여러 개 검색되었습니다. 더 정확한 이름을 입력하세요: ${list.slice(0,8).map((m:any)=>m.name).join(", ")}`);
  return list[0];
}
async function registerCommands(){
  const rest=new REST({version:"10"}).setToken(TOKEN);
  const commands=[
    new SlashCommandBuilder().setName("henchi").setNameLocalizations({ko:"헨치목록"}).setDescription("헨치를 검색하고 서식지를 확인합니다.").setDescriptionLocalizations({ko:"헨치를 검색하고 서식지를 확인합니다."}).addStringOption(o=>o.setName("query").setNameLocalizations({ko:"헨치"}).setDescription("검색할 헨치 이름").setDescriptionLocalizations({ko:"검색할 헨치 이름"}).setRequired(true)),
    new SlashCommandBuilder().setName("link").setNameLocalizations({ko:"연동"}).setDescription("Abyss 계정과 Discord 계정을 연동합니다.").setDescriptionLocalizations({ko:"Abyss 계정과 Discord 계정을 연동합니다."}).addStringOption(o=>o.setName("code").setNameLocalizations({ko:"코드"}).setDescription("사이트에서 생성한 10분 연동 코드").setDescriptionLocalizations({ko:"사이트에서 생성한 10분 연동 코드"}).setRequired(true)),
    new SlashCommandBuilder().setName("market").setNameLocalizations({ko:"거래소"}).setDescription("Abyss 판매 거래소").setDescriptionLocalizations({ko:"Abyss 판매 거래소"}).addSubcommand(s=>s.setName("search").setNameLocalizations({ko:"검색"}).setDescription("판매글을 조회합니다").setDescriptionLocalizations({ko:"판매글을 조회합니다"}).addStringOption(o=>o.setName("query").setNameLocalizations({ko:"검색어"}).setDescription("헨치 이름").setDescriptionLocalizations({ko:"헨치 이름"}))).addSubcommand(s=>s.setName("create").setNameLocalizations({ko:"등록"}).setDescription("판매글을 등록합니다").setDescriptionLocalizations({ko:"판매글을 등록합니다"}).addStringOption(o=>o.setName("monster").setNameLocalizations({ko:"헨치"}).setDescription("헨치 이름").setDescriptionLocalizations({ko:"헨치 이름"}).setRequired(true)).addIntegerOption(o=>o.setName("quantity").setNameLocalizations({ko:"수량"}).setDescription("수량").setDescriptionLocalizations({ko:"수량"}).setMinValue(1).setRequired(true)).addIntegerOption(o=>o.setName("price").setNameLocalizations({ko:"가격"}).setDescription("마리당 자사 가격").setDescriptionLocalizations({ko:"마리당 자사 가격"}).setMinValue(1).setRequired(true)).addStringOption(o=>o.setName("note").setNameLocalizations({ko:"메모"}).setDescription("메모").setDescriptionLocalizations({ko:"메모"}).setMaxLength(300))).addSubcommand(s=>s.setName("mine").setNameLocalizations({ko:"내거래"}).setDescription("내 판매글을 조회합니다").setDescriptionLocalizations({ko:"내 판매글을 조회합니다"})).addSubcommand(s=>s.setName("cancel").setNameLocalizations({ko:"취소"}).setDescription("내 판매글을 취소합니다").setDescriptionLocalizations({ko:"내 판매글을 취소합니다"}).addStringOption(o=>o.setName("id").setNameLocalizations({ko:"거래아이디"}).setDescription("거래 ID").setDescriptionLocalizations({ko:"거래 ID"}).setRequired(true))),
    new SlashCommandBuilder().setName("exchange").setNameLocalizations({ko:"교환소"}).setDescription("Abyss 교환 거래소").setDescriptionLocalizations({ko:"Abyss 교환 거래소"}).addSubcommand(s=>s.setName("search").setNameLocalizations({ko:"검색"}).setDescription("교환글을 조회합니다").setDescriptionLocalizations({ko:"교환글을 조회합니다"}).addStringOption(o=>o.setName("query").setNameLocalizations({ko:"검색어"}).setDescription("헨치 이름").setDescriptionLocalizations({ko:"헨치 이름"}))).addSubcommand(s=>s.setName("create").setNameLocalizations({ko:"등록"}).setDescription("교환글을 등록합니다").setDescriptionLocalizations({ko:"교환글을 등록합니다"}).addStringOption(o=>o.setName("offered").setNameLocalizations({ko:"제공헨치"}).setDescription("내가 줄 헨치").setDescriptionLocalizations({ko:"내가 줄 헨치"}).setRequired(true)).addIntegerOption(o=>o.setName("quantity").setNameLocalizations({ko:"수량"}).setDescription("내가 줄 수량").setDescriptionLocalizations({ko:"내가 줄 수량"}).setMinValue(1).setRequired(true)).addStringOption(o=>o.setName("wants").setNameLocalizations({ko:"원하는헨치"}).setDescription("원하는 헨치:수량,헨치:수량").setDescriptionLocalizations({ko:"원하는 헨치:수량,헨치:수량"}).setRequired(true)).addStringOption(o=>o.setName("note").setNameLocalizations({ko:"메모"}).setDescription("메모").setDescriptionLocalizations({ko:"메모"}).setMaxLength(300))).addSubcommand(s=>s.setName("mine").setNameLocalizations({ko:"내거래"}).setDescription("내 교환글/제안을 조회합니다").setDescriptionLocalizations({ko:"내 교환글과 제안을 조회합니다"})).addSubcommand(s=>s.setName("cancel").setNameLocalizations({ko:"취소"}).setDescription("내 교환글을 취소합니다").setDescriptionLocalizations({ko:"내 교환글을 취소합니다"}).addStringOption(o=>o.setName("id").setNameLocalizations({ko:"교환아이디"}).setDescription("교환글 ID").setDescriptionLocalizations({ko:"교환글 ID"}).setRequired(true))),
  ].map(c=>c.toJSON());
  if(GUILD_ID){
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands});
    console.log(`Registered ${commands.length} guild commands to ${GUILD_ID}`);
    // 서버 명령어 등록이 성공한 뒤에만 이전 전역 명령어를 정리합니다.
    try{
      await rest.put(Routes.applicationCommands(CLIENT_ID),{body:[]});
      console.log("Cleared global commands");
    }catch(error){
      console.error("Failed to clear global commands", error);
    }
  }else{
    await rest.put(Routes.applicationCommands(CLIENT_ID),{body:commands});
    console.log(`Registered ${commands.length} global commands`);
  }
}
function listingEmbed(l:any){return new EmbedBuilder().setTitle(`🏪 ${l.monster?.name||l.offered?.monster?.name||"거래"}`).setDescription(l.note||"메모 없음").addFields({name:"수량",value:String(l.quantity??l.offered?.quantity??"-"),inline:true},{name:"가격",value:l.priceBoxes!=null?`${l.priceBoxes} BOX`:`교환`,inline:true},{name:"판매자",value:l.sellerGameNickname||l.ownerGameNickname||"-",inline:true}).setFooter({text:`ID: ${l.id}`});}
async function handle(i:ChatInputCommandInteraction){
  if(i.commandName==='henchi'){
    const query=i.options.getString('query',true).trim();
    const data=await api(`/api/internal/discord/monsters?query=${encodeURIComponent(query)}`,{method:'GET'});
    const list=data.monsters||[];
    if(!list.length) return i.reply({content:`❌ \`${query}\`에 해당하는 헨치를 찾지 못했습니다.`});
    const exact=list.filter((m:any)=>String(m.name||'').toLowerCase()===query.toLowerCase());
    const results=exact.length?exact:list.slice(0,8);
    const embeds=results.map((m:any)=>{
      const imageUrl=typeof m.imageUrl==='string'?(m.imageUrl.startsWith('/')?`${API}${m.imageUrl}`:m.imageUrl):'';
      const embed=new EmbedBuilder().setTitle(`📖 ${m.name}`).setColor(0x22d3ee).addFields(
        {name:'📍 서식지',value:String(m.habitat||'정보 없음'),inline:false},
        {name:'속성',value:String(m.attribute||'-'),inline:true},
        {name:'종류',value:String(m.type||'-'),inline:true},
        {name:'레벨',value:String(m.level||'-'),inline:true},
      );
      if(imageUrl) embed.setImage(imageUrl);
      return embed;
    });
    if(!exact.length && results.length>1) embeds[0].setFooter({text:`검색 결과 ${list.length}개 · 정확한 이름을 입력하면 해당 헨치만 표시됩니다.`});
    return i.reply({embeds:embeds.slice(0,8)});
  }
  if(i.commandName==='link'){ const data=await api('/api/internal/discord/link',{method:'POST',body:JSON.stringify({code:i.options.getString('code',true),discordUserId:i.user.id,discordUsername:i.user.username})}); return i.reply({content:`✅ ${data.member.nickname} 계정과 연동되었습니다. 이제 /market, /exchange를 사용할 수 있습니다.`,ephemeral:true}); }
  const member=await linked(i); const group=i.commandName; const sub=i.options.getSubcommand();
  if(group==='market'){
    if(sub==='search'){const data=await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'sell-list',memberId:member.id,query:i.options.getString('query')||''})}); const list=data.listings.slice(0,10); return i.reply({embeds:list.length?list.map(listingEmbed):[new EmbedBuilder().setTitle('🏪 거래소').setDescription('검색 결과가 없습니다.')],ephemeral:true});}
    if(sub==='mine'){const data=await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'my-sell',memberId:member.id})}); return i.reply({embeds:data.listings.slice(0,10).map(listingEmbed)||[],content:data.listings.length?undefined:'내 판매글이 없습니다.',ephemeral:true});}
    if(sub==='cancel'){await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'sell-cancel',memberId:member.id,id:i.options.getString('id',true)})}); return i.reply({content:'✅ 판매글을 취소했습니다.',ephemeral:true});}
    if(sub==='create'){const m=await monster(i.options.getString('monster',true)); const data=await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'sell-create',memberId:member.id,monster:m,quantity:i.options.getInteger('quantity',true),unitPriceBoxes:i.options.getInteger('price',true),note:i.options.getString('note')})}); return i.reply({content:`✅ 판매글 등록 완료\n${data.listing.monster.name} × ${data.listing.quantity}\n마리당 ${data.listing.priceBoxes/data.listing.quantity} BOX\nID: ${data.listing.id}`,ephemeral:true});}
  }
  if(group==='exchange'){
    if(sub==='search'){const data=await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'exchange-list',memberId:member.id,query:i.options.getString('query')||''})}); const list=data.exchanges.slice(0,10); const embeds=list.map((l:any)=>new EmbedBuilder().setTitle(`🔄 ${l.offered.monster.name} × ${l.offered.quantity}`).setDescription(l.note||'메모 없음').addFields({name:'원하는 헨치',value:l.wants.map((w:any)=>`${w.monster.name} × ${w.quantity}`).join('\n'),inline:false},{name:'등록자',value:l.ownerGameNickname,inline:true}).setFooter({text:`ID: ${l.id}`})); return i.reply({embeds:embeds.length?embeds:[new EmbedBuilder().setDescription('교환글이 없습니다.')],ephemeral:true});}
    if(sub==='mine'){const data=await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'my-exchange',memberId:member.id})}); return i.reply({content:`등록 교환글 ${data.listings.length}개 · 받은 제안 ${data.received.length}개 · 보낸 제안 ${data.sent.length}개`,ephemeral:true});}
    if(sub==='cancel'){await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'exchange-cancel',memberId:member.id,id:i.options.getString('id',true)})}); return i.reply({content:'✅ 교환글을 취소했습니다.',ephemeral:true});}
    if(sub==='create'){const offered=await monster(i.options.getString('offered',true)); const raw=i.options.getString('wants',true).split(',').map(x=>x.trim()).filter(Boolean); if(!raw.length||raw.length>5) throw new Error('원하는 헨치는 1~5개까지 입력하세요. 예: 로엘:1,아쿠아:2'); const wants=[]; for(const part of raw){const [name,q]=part.split(':').map(x=>x.trim()); const m=await monster(name); const qty=Number(q); if(!Number.isInteger(qty)||qty<1) throw new Error(`${name} 수량이 올바르지 않습니다.`); wants.push({monster:m,quantity:qty});} const data=await api('/api/internal/discord/marketplace',{method:'POST',body:JSON.stringify({action:'exchange-create',memberId:member.id,offered,offeredQuantity:i.options.getInteger('quantity',true),wants,note:i.options.getString('note')})}); return i.reply({content:`✅ 교환글 등록 완료\n${data.listing.offered.monster.name} × ${data.listing.offered.quantity}\n원하는 헨치: ${data.listing.wants.map((w:any)=>`${w.monster.name} × ${w.quantity}`).join(', ')}\nID: ${data.listing.id}`,ephemeral:true});}
  }
}

const client=new Client({intents:[GatewayIntentBits.Guilds]});
client.once('ready',async c=>{console.log(`Logged in as ${c.user.tag}`); await registerCommands(); setInterval(async()=>{try{const data=await api('/api/internal/discord/notifications',{method:'GET'}); for(const n of data.notifications||[]){try{const user=await c.users.fetch(n.discordUserId); await user.send({embeds:[new EmbedBuilder().setTitle(`🔔 ${n.title}`).setDescription(n.body).setColor(0x22d3ee).setFooter({text:'Abyss 거래소'})]}); await api('/api/internal/discord/notifications/sent',{method:'POST',body:JSON.stringify({id:n.id})});}catch(e){console.error('Discord DM failed',e);}}}catch(e){console.error('notification poll failed',e);}},3000);});
client.on('interactionCreate',async interaction=>{if(!interaction.isChatInputCommand())return; try{await handle(interaction);}catch(e){const msg=e instanceof Error?e.message:'처리 중 오류가 발생했습니다.'; if(interaction.replied||interaction.deferred) await interaction.followUp({content:`❌ ${msg}`,ephemeral:true}); else await interaction.reply({content:`❌ ${msg}`,ephemeral:true});}});
client.login(TOKEN);
