import type { Article } from "../../types";

// 流程与来源同意大利语文章（2026年11月15日核对）。
export const lottoPratiche: Article = {
  slug: "batch-of-20-vies-applications",
  title: "VIES申请批量办理：税务代表操作指南",
  description: "税务代表如何在一个批次中上传最多20份VIES申请：Excel文件、文件压缩包、平台的核对，以及之后的步骤。本文逐步说明批量办理的流程。",
  h1: "一批办理20份VIES申请：税务代表操作指南",
  label: "一批办理20份申请",
  keyword: "VIES申请",
  summary:
    "一个批次最多包含20份一起上传的VIES申请：一个包含企业数据的Excel文件，加上每家企业一个文件压缩包。平台把每一行与对应的压缩包匹配、读取文件，并提示缺少的内容。此后整个批次作为一个整体办理：草稿、一份对账单、批量签署、出具保单。",
  sections: [
    {
      id: "cosa-serve",
      heading: "准备批次需要什么",
      blocks: [
        {
          type: "list",
          items: ["批次的Excel模板，包含三个工作表：CONTRAENTE（投保人）、RAPPRESENTANTE FISCALE（税务代表）和BENEFICIARIO（受益人）。", "在CONTRAENTE工作表中，每家企业占一行，ZIP列填写其文件压缩包的名称。", "每家企业一个ZIP压缩包，内含清单上的文件。", "每个批次不超过20行。"],
        },
        { type: "p", text: "每家企业的文件清单见指南[境外企业办理意大利VIES保函需要哪些文件](article:documenti)。" },
      ],
    },
    {
      id: "come-compilare-excel",
      heading: "如何填写Excel",
      blocks: [
        {
          type: "list",
          items: [
            "ZIP列可以填写数字、简称或客户的内部代码：必须与压缩包的名称一致。大小写、空格和扩展名不影响匹配。",
            "企业以意大利税务局分配的意大利税号或增值税号来识别：在这些列中填写境外登记代码会被拒绝，并显示提示信息。",
            "税务代表和受益人分别从各自的工作表读取。",
            "受益人是税务代表税务住所所在地的意大利税务局省级税务局。",
          ],
        },
      ],
    },
    {
      id: "al-caricamento",
      heading: "上传时会发生什么",
      blocks: [
        {
          type: "steps",
          items: [
            { title: "匹配", text: "平台把Excel的每一行与对应的压缩包匹配，并提示没有对应行的压缩包。" },
            { title: "读取", text: "平台打开压缩包并读取文件：读取过程中，该行显示为核对中。" },
            { title: "比对", text: "把文件中的数据与Excel中的数据进行比对，并在各文件之间相互比对。" },
            { title: "结果", text: "每一行或者显示为就绪，或者说明缺少什么、哪里不一致，以及应当如何处理。" },
            { title: "创建批次", text: "用就绪的行创建批次：每家企业成为一份申请，并有自己的编号。" },
          ],
        },
      ],
    },
    {
      id: "riga-bloccata",
      heading: "某一行无法通过时",
      blocks: [
        {
          type: "p",
          text: "文件缺失、过期或无法读取，都会使该行无法通过。无法通过的行不会进入批次：其他企业继续办理，该企业更正后在之后的批次中上传。",
        },
        {
          type: "p",
          text: "遇到难以辨认的扫描件，自动读取可能出错。如果某一行只是因为文件核对未通过，而该文件已经通过其他方式核实，您可以在自行承担责任的前提下强制提交：原因、备注、您的姓名和时间都会记录在该申请中。",
        },
      ],
    },
    {
      id: "dopo-la-creazione",
      heading: "批次创建之后",
      blocks: [
        {
          type: "p",
          text: "此后批次按照[从申请到VIES保单出具](article:richiesta-polizza)中的八个步骤办理：草稿只核对一次，只有一份对账单，签署批量完成。关于签署，见[带电子签名的保单（.p7m格式）](article:firma-p7m)。",
        },
        {
          type: "list",
          items: ["在申请菜单中，每个批次都有自己的编号，并显示各阶段的申请数量。", "整个批次的文件可以打包一次下载，每份申请一个文件夹。", "到期日历列出全部保单，并在到期前一个月发出提醒。"],
        },
      ],
    },
    {
      id: "garanzia-del-rappresentante",
      heading: "与您本人有关的担保",
      blocks: [
        {
          type: "p",
          text: "代表两家或更多企业的税务代表，本人还必须提供一项担保，它不同于被代表企业的VIES担保。金额和期限见指南[税务代表的担保与VIES担保](article:garanzia-rappresentante)。",
        },
      ],
    },
  ],
  faq: [
    {
      q: "可以上传超过20份申请吗？",
      a: "可以，分成多个批次即可：每个批次最多20份申请，并有自己的编号、状态和对账单。所有批次都保留在平台上，可以查看各阶段的申请汇总，也可以连同其中的申请一起搜索、筛选和导出。",
    },
    {
      q: "文件压缩包应当如何命名？",
      a: "与Excel中该企业所在行的ZIP列一致：可以是数字、简称或客户的内部代码。平台在匹配行与压缩包时不区分大小写、空格和扩展名，因此Excel中的值和文件名只能在这些细节上有所不同。每家企业需要一个压缩包。",
    },
    {
      q: "批次由谁付款、由谁签署？",
      a: "由上传批次的一方。对账单以其公司为抬头：通过银行转账付款，并签署确认。付款之后，使用电子签名批量签署每份申请的保险公司留存联保单和投保前的告知文件。保单草稿不需要签署，只需在付款之前核对。",
    },
  ],
  sources: [
    { label: "意大利税务局：2025年4月14日第178713/2025号令（意大利语）", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-14-aprile-2025" },
    { label: "Normattiva：1972年10月26日第633号总统令第35条（税务代表对文件的核实，意大利语）", href: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1972-10-26;633~art35" },
    { label: "意大利税务局：2025年4月17日第186368/2025号令（税务代表的担保，意大利语）", href: "https://www.agenziaentrate.gov.it/portale/provvedimento-del-17-aprile-2025" },
  ],
};
