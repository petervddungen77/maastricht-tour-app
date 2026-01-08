# Balanced Scorecard Usage Guide

## Purpose
This guide explains how to use and maintain the Balanced Scorecard for the Maastricht Tour App.

## Files Structure

```
maastricht-tour-app/
├── BALANCED_SCORECARD.md          # Main scorecard documentation
├── balanced-scorecard-data.json   # Machine-readable data and metrics
└── SCORECARD_USAGE_GUIDE.md      # This file
```

## How to Use

### 1. Understanding the Scorecard

The Balanced Scorecard tracks performance across four perspectives:

- **Financial**: Revenue, costs, and profitability metrics
- **Customer**: User satisfaction, engagement, and growth
- **Internal Process**: Operational efficiency and quality
- **Learning & Growth**: Innovation and capability development

Each perspective has:
- Strategic goals
- Key Performance Indicators (KPIs)
- Target values
- Current values
- Status indicators (🟢 🟡 🔴)
- Initiatives to achieve goals

### 2. Updating Metrics

#### Monthly Updates (Required)

1. Open `balanced-scorecard-data.json`
2. Update the `lastUpdated` field to current date
3. For each metric, update:
   - `current`: Current value
   - `status`: "green", "yellow", or "red" based on performance
   - `trend`: "up", "flat", or "down"
   - Add entry to `history` array with date and value

Example:
```json
{
  "id": "mau",
  "name": "Monthly Active Users (MAU)",
  "target": 10000,
  "current": 1250,
  "status": "yellow",
  "trend": "up",
  "history": [
    {"date": "2026-01", "value": 1250},
    {"date": "2025-12", "value": 950},
    {"date": "2025-11", "value": 720}
  ]
}
```

4. Update corresponding values in `BALANCED_SCORECARD.md` tables
5. Update status emojis:
   - 🟢 if at or above target (or below for metrics like CAC, churn)
   - 🟡 if within 20% of target
   - 🔴 if more than 20% away from target

#### Quarterly Updates (Required)

1. Update `reportingPeriod` in the JSON file
2. Review all initiatives:
   - Update `status`: "planned", "in_progress", "completed", "blocked"
   - Update `progress`: 0-100
   - Assign `owner` and `dueDate` if not set
3. Add new initiatives as needed
4. Archive or remove completed initiatives

#### Annual Reviews (Required)

1. Evaluate all targets and adjust based on:
   - Previous year's performance
   - Market conditions
   - Strategic direction changes
2. Update strategic goals if needed
3. Archive old data or create a new file for the new year
4. Review and update the strategy map in the main document

### 3. Status Determination

Use this decision tree to set status:

```
Is current value available?
├─ No → Status = red
└─ Yes
   └─ Is metric meeting target?
      ├─ Yes → Status = green
      ├─ Within 20% of target → Status = yellow
      └─ More than 20% away → Status = red
```

**Special cases:**
- Metrics with `targetOperator: "<="` (CAC, churn, etc.): Green if current ≤ target
- Metrics with `targetOperator: ">="` (NPS, etc.): Green if current ≥ target

### 4. Data Entry Best Practices

1. **Be consistent**: Update all metrics on the same schedule
2. **Be accurate**: Verify data sources before entering
3. **Be timely**: Don't let updates lag more than a week
4. **Document changes**: Add notes if targets or definitions change
5. **Track trends**: The history array helps identify patterns

### 5. Reporting

#### Monthly Report Format

```markdown
# Scorecard Update - [Month Year]

## Executive Summary
- Overall status: [Brief assessment]
- Key wins: [Top 3 achievements]
- Key concerns: [Top 3 issues]

## Perspective Highlights

### Financial
- [Metric]: Current X, Target Y, Status Z
- [Key insight or action needed]

### Customer
- [Similar format]

### Internal Process
- [Similar format]

### Learning & Growth
- [Similar format]

## Initiative Updates
- [Initiative name]: [Progress %] - [Brief update]

## Next Month Focus
- [Top 3 priorities]
```

### 6. Integration with Other Tools

The JSON format allows integration with:

- **Dashboards**: Import into BI tools (Tableau, PowerBI, etc.)
- **Spreadsheets**: Parse JSON to populate Excel/Google Sheets
- **Web apps**: Build custom dashboard using the data
- **Automation**: Use scripts to auto-update from analytics platforms

### 7. Common Tasks

#### Adding a New Metric

1. Add to JSON under appropriate perspective:
```json
{
  "id": "new_metric_id",
  "name": "Metric Name",
  "unit": "unit",
  "target": 100,
  "current": null,
  "status": "red",
  "trend": "flat",
  "history": []
}
```

2. Add corresponding row to markdown table

#### Adding a New Initiative

1. Add to JSON under appropriate perspective:
```json
{
  "id": "i1",
  "title": "Initiative Title",
  "description": "Detailed description",
  "status": "planned",
  "priority": "high",
  "owner": null,
  "dueDate": null,
  "progress": 0
}
```

2. Add to markdown initiatives list

#### Archiving Old Data

Create annual archives:
```
archives/
├── balanced-scorecard-2026.json
├── balanced-scorecard-2025.json
└── balanced-scorecard-2024.json
```

### 8. Review Meetings

#### Monthly Review (1 hour)
- Review all metrics
- Update status and trends
- Identify issues requiring immediate attention
- Quick initiative updates

#### Quarterly Review (2-3 hours)
- Deep dive each perspective
- Strategy alignment check
- Initiative portfolio review
- Adjust priorities

#### Annual Review (Half day)
- Comprehensive strategy assessment
- Set new annual targets
- Major initiative planning
- Long-term trend analysis

### 9. Success Tips

1. **Make it visible**: Share scorecard with entire team
2. **Make it actionable**: Every red status should trigger an action
3. **Make it collaborative**: Involve team in setting targets
4. **Make it iterative**: Adjust targets if they're too easy or impossible
5. **Make it relevant**: Focus on metrics that drive decisions

### 10. Tools and Resources

Recommended tools for managing the scorecard:
- **VS Code**: Edit JSON with validation
- **GitHub**: Version control for scorecard files
- **Cron jobs**: Automate reminder emails
- **Python/Node.js**: Scripts to generate reports
- **Grafana/Metabase**: Visualization dashboards

### 11. Troubleshooting

**Q: A metric is consistently red. What should I do?**
A: Either adjust the target (if unrealistic) or create an initiative to address it.

**Q: We don't have data for a metric. Should I remove it?**
A: No, but add an initiative to implement tracking for that metric.

**Q: How do I decide what status to assign?**
A: Use the decision tree in section 3, and be honest about performance.

**Q: Can I add custom fields to the JSON?**
A: Yes! The structure is flexible. Add fields as needed for your use case.

---

## Quick Start Checklist

- [ ] Read through BALANCED_SCORECARD.md
- [ ] Set up monthly review meeting
- [ ] Assign metric owners
- [ ] Set up data collection processes
- [ ] Schedule first quarterly review
- [ ] Share scorecard with team
- [ ] Add scorecard review to team calendar

---

**Last Updated**: 2026-01-08
**Version**: 1.0.0
