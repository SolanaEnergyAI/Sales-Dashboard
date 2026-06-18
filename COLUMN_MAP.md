# Solana Energy — Column ID Map (verified)

Source-of-truth mapping of every dashboard metric to its Monday column ID on
each board. **Verified directly against the live boards** (column *IDs* are
stable even if a column is renamed).

| Sale metric | 📞 Virtual Call Centre `7387546685` | 🤝 Sales Funnel `3012085157` | 🔄️ Installations In Progress `4625121791` |
|---|---|---|---|
| **Creation Log** | `creation_log` | `pulse_log_mkt5pwbr` | `creation_log` |
| **Assigned to LG** | `date0__1` | `date__1` | `date__1` |
| **Booked Date** | — | `date1` | `date3` |
| **Appointment Date** | `date2` | `date5` | `date5` |
| **Sold Date** | — | — | `date9` |
| **Lead Source** | `lead_source` | `lead_source_1` | `lead_source_1` |
| **Lead Gen** (person) | `person` | `people8` | `people4` |
| **Sales Rep** (person) | `people7__1` | `person` | `people5` |
| **CPL** | `numbers__1` | `numbers__1` | `numbers__1` |
| **Revenue (sale value)** | — | — | `formula98` (Total Cash Price) |
| **Gross Profit** | — | — | `formula_mks93vrv` |
| **Realized Revenue** (post-install) | — | — | `formula_mks9q4r9` |

### Notes
- **Booked Date** is auto-stamped when a lead enters the Sales Funnel, and again
  carried on the Installations board — there is no Booked Date in the Virtual
  Call Centre (a lead there isn't booked yet).
- **Sold Date** exists only on Installations; a filled Sold Date marks a genuine
  Solana sale (empty = subcontracting job).
- **Revenue** uses **Total Cash Price** (`formula98`) — the deal value, which is
  populated at the point of sale. The dedicated **💵 Total Revenue**
  (`formula_mks9q4r9`) and **💵 Gross Profit** (`formula_mks93vrv`) formulas only
  populate *after* install/job-costing, so they read 0/null on fresh sales; they
  are wired (`realizedRevenue`, `grossProfit`) for when those figures are filled.
- All three are formula columns, read via the API's `display_value`.

### Sales Funnel "Post Sat" group IDs (a *sat* appointment)
`group_mm3zhb33` Proposal Pending · `new_group41259` Proposal Sent ·
`new_group35090` Sale Pending · `new_group69484` Sat Not Sold
