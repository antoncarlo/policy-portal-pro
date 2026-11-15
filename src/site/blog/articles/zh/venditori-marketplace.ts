import type { Article } from "../../types";

// 事实与来源同意大利语文章（2026年11月15日核对）。
export const venditoriMarketplace: Article = {
  slug: "non-eu-sellers-italian-vat-and-vies",
  title: "非欧盟卖家：意大利增值税号与VIES办理步骤",
  description: "从委任税务代表到加入VIES：总部在欧盟以外、在意大利和欧洲销售的企业需要办理的各个步骤，以及不少于5万欧元的担保。本文按顺序逐步说明。",
  h1: "非欧盟卖家：意大利增值税号与VIES，逐步说明",
  label: "非欧盟卖家：增值税号与VIES",
  keyword: "意大利增值税号",
  summary:
    "打算从意大利进行欧盟内部交易的非欧盟企业，需要委任税务代表、取得增值税号、提供不少于5万欧元且期限不少于36个月的担保，并在意大利税务局审核之后申请加入VIES。没有担保，就不能加入VIES。",
  sections: [
    {
      id: "quando-serve",
      heading: "什么时候需要意大利增值税号和VIES",
      blocks: [
        {
          type: "p",
          text: "境外企业是否需要、何时需要在意大利登记增值税，取决于销售方式和货物的发出地，应由企业的税务顾问判断。本指南说明的是之后的一步：企业已在意大利登记，并打算进行欧盟内部交易，即与其他欧盟成员国的增值税纳税人进行交易。为此，增值税号必须列入VIES数据库。",
        },
        {
          type: "p",
          text: "关于担保的规定，适用于所有总部在欧盟和欧洲经济区以外、并通过税务代表开展业务的企业：例如总部在中国、日本、印度、巴基斯坦、美国、巴西或越南的企业。",
        },
      ],
    },
    {
      id: "rappresentante-o-identificazione",
      heading: "税务代表还是直接登记",
      blocks: [
        {
          type: "table",
          columns: ["方式", "谁可以采用", "VIES担保"],
          rows: [
            ["直接登记", "在其他欧盟成员国开展经营的企业，或者在与意大利订有间接税互助法律文件的第三国开展经营的企业。", "与此方式无关：该规定针对的是通过税务代表开展业务的企业。"],
            ["税务代表", "在意大利没有常设机构的其他非居民企业。", "需要：适用于总部在欧盟和欧洲经济区以外、并希望在VIES中开展业务的企业。"],
          ],
        },
        {
          type: "p",
          text: "税务代表须在意大利居住，按照第441/1997号总统令第1条第4款规定的形式委任，并就增值税义务与企业承担连带责任。委任须在交易之前告知交易对方。",
        },
      ],
    },
    {
      id: "i-passi",
      heading: "办理步骤",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "委任税务代表", text: "企业选定一名在意大利居住的税务代表，并向其出具委托书。" },
            { title: "开业申报", text: "通过开业申报申请增值税号；非自然人使用AA7表格。" },
            { title: "选择加入VIES", text: "在开业申报中，或之后通过网上办理，表明打算进行欧盟内部交易。" },
            { title: "担保", text: "尚未取得增值税号的企业，在提交开业申报时一并提供担保；已有增值税号的企业，在申请加入之前提供。" },
            { title: "税务局审核", text: "意大利税务局省级税务局审核担保是否符合要求并告知结果。" },
            { title: "加入VIES", text: "自收到该通知之日起，即可申请加入。" },
          ],
        },
      ],
    },
    {
      id: "la-garanzia",
      heading: "担保要点",
      blocks: [
        {
          type: "list",
          items: ["不少于5万欧元，期限自提交之日起不少于36个月。", "以税务代表税务住所所在地的省级税务局现任局长为受益人。", "可采用三种形式之一，比较见[证券质押、银行保函还是保险保函](article:forme-garanzia)。"],
        },
        {
          type: "p",
          text: "办理保险保函所需的文件，见[境外企业办理意大利VIES保函需要哪些文件](article:documenti)。完整的规定见[意大利VIES担保是什么，谁必须提供](article:garanzia-vies)。",
        },
      ],
    },
    {
      id: "restare-nel-vies",
      heading: "如何保留在VIES中",
      blocks: [
        {
          type: "list",
          items: ["按时提交欧盟内部交易汇总申报表：如果连续四个季度没有提交任何申报表，税务局即推定企业不再打算进行此类交易，并在事先通知后将其除名。", "留意担保的到期日：担保期限自提交之日起不少于36个月。"],
        },
        {
          type: "p",
          text: "如果您的企业属于这种情况，[面向非欧盟卖家的意大利VIES担保](page:sellers)页面说明了如何申请保函。",
        },
      ],
    },
  ],
  faq: [
    {
      q: "非欧盟企业可以不委任税务代表而取得意大利增值税号吗？",
      a: "只有在可以直接登记的情况下才可以：直接登记适用于在其他欧盟成员国开展经营的企业，或者在与意大利订有间接税互助法律文件的第三国开展经营的企业。在其他情况下，在意大利没有常设机构的非居民企业须通过在意大利居住的税务代表开展业务。",
    },
    {
      q: "VIES担保是在取得增值税号之前还是之后提供？",
      a: "视情况而定。尚未取得增值税号的企业，在提交申请加入VIES的开业申报时一并提供担保。已有增值税号的企业，在申请加入之前提供。无论哪种情况，都只有在省级税务局审核担保并告知结果之后，才能申请加入VIES。",
    },
    {
      q: "企业一年没有使用VIES会怎样？",
      a: "如果连续四个季度没有提交任何欧盟内部交易汇总申报表，意大利税务局即推定企业不再打算进行此类交易，并在发出通知后把增值税号从VIES中除名。依据是第633/1972号总统令第35条第7-bis款；自2027年起，这一规则规定在《增值税统一法》第68条第9款。",
    },
  ],
  sources: [
    { label: "意大利税务局：加入VIES数据库的说明（意大利语）", href: "https://www.agenziaentrate.gov.it/portale/schede/istanze/inclusione-archivio-vies/scheda-info-partite-iva_intra" },
    { label: "意大利税务局：2025年4月14日第178713/2025号令（意大利语）", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva：1972年10月26日第633号总统令第17条（税务代表，意大利语）", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art17" },
    { label: "Normattiva：1972年10月26日第633号总统令第35条（意大利语）", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "Normattiva：2026年1月19日第10号立法令《增值税统一法》第68条和第70条（意大利语）", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:2026-01-19;10" },
  ],
};
