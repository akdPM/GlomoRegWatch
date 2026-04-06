export const getSeededDocuments = () => [
    {
        source: 'RBI',
        title: 'Revision of LRS Purpose Codes and TCS Thresholds for FY 2026-27',
        pdf_url: 'https://rbi.org.in/Scripts/NotificationUser.aspx?Id=12563&Mode=0',
        raw_content: 'RBI has revised the Liberalised Remittance Scheme (LRS) reporting codes and applied new TCS limits. Entities dealing in cross-border remittances must comply immediately. Quote: "All authorized dealer banks and entities facilitating LRS must update purpose code validations by April 1, 2026."',
        published_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
        source: 'IFSCA',
        title: 'Specification of Certification Course for KMPs and other employees of Capital Market Intermediaries under the IFSCA (Capital Market Intermediaries) Regulations, 2025',
        pdf_url: 'https://ifsca.gov.in/CommonDirect/GetFileView?id=d575554ec59b09e7fde503d3a89be802&fileName=Specification_of_Certification_Course_for_KMPs_and_other_employees_of_Capital_Market_Intermediaries_under_the_IFSCA_Capital_Market_Intermediaries_Regulations_2025_02042026.pdf',
        raw_content: 'This circular is issued in exercise of the powers conferred under Sections 12 and 13 of the International Financial Services Centres Authority Act, 2019. It outlines the certification prerequisites for key managerial personnel operating within the IFSC framework to establish uniform operational excellence.',
        published_at: new Date('2026-04-02').toISOString()
    },
    {
        source: 'IFSCA',
        title: 'Circular on Specification of Certification Course for KMPs/Employees under IFSCA (Fund Management) Regulations, 2025',
        pdf_url: 'https://ifsca.gov.in/CommonDirect/GetFileView?id=d575554ec59b09e7fde503d3a89be802&fileName=Circular_on_Specification_of_Certification_Course_for_KMPs_Employees_under_IFSCA_Fund_Management_Regulations_2025.pdf',
        raw_content: 'To standardize the operational qualifications of Fund Management Entities (FMEs), the Authority has specified the base certification course required by KMPs prior to assuming operational roles within the IFSC capital markets context.',
        published_at: new Date('2026-04-01').toISOString()
    },
    {
        source: 'FATF',
        title: 'FATF Grey List Update — Kuwait and Papua New Guinea Added',
        pdf_url: 'https://www.fatf-gafi.org/en/topics/high-risk-and-other-monitored-jurisdictions.html',
        raw_content: 'The February 2026 FATF Plenary has added Kuwait and Papua New Guinea to the Grey List (Jurisdictions under Increased Monitoring). Algeria has substantially completed its action plan. DPRK and Iran remain on the Black List. "Jurisdictions should apply enhanced due diligence to transactions involving newly listed entities."',
        published_at: new Date(Date.now() - 40 * 86400000).toISOString()
    },
    {
        source: 'SEBI',
        title: 'SEBI Circular on ESG Rating Providers — Registration and Conduct',
        pdf_url: 'https://www.sebi.gov.in/legal/circulars.html',
        raw_content: 'SEBI has introduced a new framework for ESG rating providers covering registration, conduct, and disclosures. "Only registered rating providers may issue Tier-1 classification metrics for operational compliance."',
        published_at: new Date(Date.now() - 20 * 86400000).toISOString()
    }
];
