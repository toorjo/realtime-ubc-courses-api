import { getSiteHtml, trim } from "../helpers";
import { SectionPageData } from "../../models/pages";
import cheerio from "cheerio";
import { Schedule } from "src/models";

export class SectionPageScraper {
  async getData(subject: string, course: string, section: string): Promise<SectionPageData> {
    const url: string = `https://courses.students.ubc.ca/cs/courseschedule?pname=subjarea&tname=subj-section&dept=${subject}&course=${course}&section=${section}`;
    const html: string = await getSiteHtml(url);
    return this.parseHtml(html);
  }

  /**
   * Converts html text into sectionInfo Object
   * 
   * html string was from a url in the form of
   * https://courses.students.ubc.ca/cs/courseschedule?pname=subjarea&tname=subj-section&dept=CPSC&course=100&section=101 
   * 
   * @param  {string} html
   * @returns section_info 
   * 
   */
  parseHtml(html: string): SectionPageData {
    const $ = cheerio.load(html);
    const textbookList: Array<string> = [];
    const textbookRows: Cheerio = $("body > div.container > div.content.expand > table.sortable.table.table-striped.section-summary > tbody").children();

    textbookRows.each((i: number, element: CheerioElement) => {
      let textbookRow: Cheerio = $(element); 
      let textbookName: string = textbookRow.children().first().text();
      textbookList.push(textbookName);
    });
 
    const tableRows: Cheerio = $('thead:contains(Term)').parent().children("tbody").children();
    const infoRow = tableRows.first().children();

    let restrictions: Array<string> = [];
    $("ol li").each((i: number, element: CheerioElement)=>{
      let li: Cheerio = $(element);
      for(let line of li.text().split("-OR-")) {
        restrictions.push(line.trim());
      }
    })

    let subject = $("body > div.container > ul > li:nth-child(3) > a").text();
    let course = $("body > div.container > ul > li:nth-child(4)").text().split(" ")[1];
    let section = $("body > div.container > ul > li.active").text().split(" ")[2];

    let schedule = this.parseSchedule($(tableRows[0]));
    for (let i=1; i<tableRows.length; i++) {
      schedule = schedule.concat(this.parseSchedule($(tableRows[i])));
    }

    let activityMatch = $("body > div.container > div.content.expand > h4").text().match(/\(([^)]+)\)/);
    let activity = "";
    if(activityMatch) activity = activityMatch[0].replace(/[\(\)]+/g, '')
    let status = $('strong:contains(Note: this section is )').text().replace('Note: this section is ', '');

    return {
      status: status === '' ? 'available' : status,
      activity: activity,
      name: $("body > div.container > div.content.expand > h4").text(),
      subject: subject,
      course: course,
      section: section,
      textbooks: textbookList,
      // pre_reqs: [], // TODO this shit gonna be hard as fuck
      prof: trim($("td:contains(Instructor:)").parent().children().last().text()),
      term: $('b:contains(Term )').text().replace('Term ', ''),
      year: $("button:contains(Session: )").text().split(" ")[1],
      schedule: schedule,
      total_seats_remaining: parseInt($("td:contains(Total Seats Remaining:)").parent().children().last().text()),
      currently_registered: parseInt($("td:contains(Currently Registered:)").parent().children().last().text()),
      general_seats_remaining: parseInt($("td:contains(General Seats Remaining:)").parent().children().last().text()),
      restricted_seats_remaining: parseInt($("td:contains(Restricted Seats Remaining)").parent().children().last().text()),
      seats_reserved_for: restrictions,
      credits: $('body > div.container > div.content.expand > p:nth-child(7)').text().split(" ")[2],
      link: `https://courses.students.ubc.ca/cs/courseschedule?pname=subjarea&tname=subj-section&dept=${subject}&course=${course}&section=${section}`
    }; 
  }

  /**
   * Given a cheerio/jquery tableRow element, return the times it occurs in
   * @param  {Cheerio} tableRow
   * @returns Array<Time>
   */
  parseSchedule(tableRow: Cheerio): Array<Schedule> {
    const days = trim(tableRow.children().eq(1).text()).split(" ");

    return days.map((day) => {
      return {
        day: day,
        term: tableRow.children().eq(0).text(),
        start_time: tableRow.children().eq(2).text(),
        end_time: tableRow.children().eq(3).text(),
        building: trim(tableRow.children().eq(4).text()),
        room: trim(tableRow.children().eq(5).text())
      }
    })
  }
}