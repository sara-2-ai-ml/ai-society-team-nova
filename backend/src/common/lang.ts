export type Lang = 'sq' | 'en';

/** The client's language from its Accept-Language header; Albanian unless it asks for English. */
export function langOf(header: string | string[] | undefined): Lang {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim().toLowerCase().startsWith('en') ? 'en' : 'sq';
}

// Server messages are written in Albanian; these turn them into English for English clients.
const TO_ENGLISH: [RegExp, string][] = [
  [/Përdoruesi ose fjalëkalimi është i gabuar/g, 'Wrong username or password'],
  [/Kërkesa nuk u gjet/g, 'Request not found'],
  [/Mungon numri i protokollit/g, 'The protocol number is missing'],
  [/Numri (.+?) është regjistruar më parë/g, 'Number $1 is already registered'],
  [/Data mungon ose nuk lexohet/g, 'The date is missing or cannot be read'],
  [/Data nuk mund të jetë në të ardhmen/g, 'The date cannot be in the future'],
  [/Mungon lënda/g, 'The subject is missing'],
  [/Drejtoria\/agjencia "(.+?)" nuk njihet/g, 'Unknown department/agency "$1"'],
  [/Drejtoria\/agjencia nuk njihet/g, 'Unknown department/agency'],
  [/Drejtoria nuk njihet/g, 'Unknown department'],
  [/Vetëm operatori e ridërgon një kërkesë/g, 'Only the operator can resend a request'],
  [/Ridërgohen vetëm kërkesat e kthyera/g, 'Only returned requests can be resent'],
  [/Zgjidhni drejtorinë\/agjencinë ku do dërgohet/g, 'Choose the department/agency to send it to'],
  [/Vetëm drejtoria\/agjencia që e ka marrë mund ta ndryshojë/g, 'Only the department/agency that received it can change it'],
  [/Kërkesa është nisur tashmë/g, 'The request has already been started'],
  [/Kërkesa nuk është e hapur/g, 'The request is not open'],
  [/Shkruani pse po e ktheni kërkesën/g, 'Write why you are returning the request'],
  [/Skedari nuk lexohet\. Ruajeni si Excel \.xlsx dhe provoni sërish\./g, 'The file cannot be read. Save it as Excel .xlsx and try again.'],
  [/Nuk u gjet një fletë me kolonat: (.+?)\. Shkarkoni shabllonin dhe plotësojeni atë\./g, 'No sheet has the columns: $1. Download the template and fill it in.'],
  [/Zgjidhni një skedar Excel \(\.xlsx\)/g, 'Choose an Excel file (.xlsx)'],
  [/Skedari nuk ka asnjë rresht me kërkesa/g, 'The file has no request rows'],
  [/Periudha nuk është e vlefshme/g, 'The period is not valid'],
  [/Periudha mund të jetë deri në një vit/g, 'The period can be at most one year'],
  [/date duhet të jetë YYYY-MM-DD/g, 'date must be YYYY-MM-DD'],
];

export function translateMessage(message: string, lang: Lang): string {
  if (lang === 'sq') return message;
  return TO_ENGLISH.reduce((text, [pattern, english]) => text.replace(pattern, english), message);
}
