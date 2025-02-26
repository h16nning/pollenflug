import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useState } from "react";
import { handlePin, usePinned } from "./pin";
import { getLocation, locations } from "./locations";
import { Location, PollenflugApiData, Pollenflug, Day, DayDict, PollenflugItem } from "./types";

function getPollenDisplay(value: string): { color: Color; value: string } {
  switch (value) {
    case "0":
      return { color: Color.Green, value: "Keine Belastung" };
    case "0-1":
      return { color: Color.Green, value: "Keine bis geringe Belastung" };
    case "1":
      return { color: Color.Yellow, value: "Geringe Belastung" };
    case "1-2":
      return { color: Color.Yellow, value: "Geringe bis mittlere Belastung" };
    case "2":
      return { color: Color.Orange, value: "Mittlere Belastung" };
    case "2-3":
      return { color: Color.Orange, value: "Mittlere bis hohe Belastung" };
    case "3":
      return { color: Color.Red, value: "Hohe Belastung" };
    default:
      console.log("Unknown value:", value);
      return { color: Color.Magenta, value: "Unbekannter Wert" };
  }
}

function usePollenflugApi() {
  // TODO implement caching until next_update
  return useFetch<PollenflugApiData>(`https://opendata.dwd.de/climate_environment/health/alerts/s31fg.json`);
}

function usePollenflug(location: Location): { pollenflug?: Pollenflug; isLoading: boolean } {
  const { data, isLoading } = usePollenflugApi();

  if (!data) {
    return { pollenflug: undefined, isLoading };
  }

  const content = data.content.find((item) => item.partregion_id === location.partregion_id);
  if (!content) {
    return { pollenflug: undefined, isLoading };
  }

  // include key in the object
  const pollen = Object.entries(content.Pollen).map(([name, values]) => ({ name, ...values }));

  return { pollenflug: { location, pollen }, isLoading };
}

export default function Command() {
  const [location, setLocation] = useState<Location>(locations[0]);

  const [day, setDay] = useState<Day>("today");

  const { pollenflug, isLoading } = usePollenflug(location);

  const { pinnedItems, unpinnedItems, hasPinned, setPinned } = usePinned(pollenflug);

  const daysSection = (
    <ActionPanel.Section title="Day">
      <Action
        title={DayDict["today"]}
        icon={Icon.Sun}
        shortcut={{ modifiers: ["cmd"], key: "1" }}
        onAction={() => setDay("today")}
      />
      <Action
        title={DayDict["tomorrow"]}
        icon={Icon.Sun}
        shortcut={{ modifiers: ["cmd"], key: "2" }}
        onAction={() => setDay("tomorrow")}
      />
      <Action
        title={DayDict["dayafter_to"]}
        icon={Icon.Sun}
        shortcut={{ modifiers: ["cmd"], key: "3" }}
        onAction={() => setDay("dayafter_to")}
      />
    </ActionPanel.Section>
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder={`Pollenflug ${DayDict[day]}`}
      searchBarAccessory={<LocationDropdown onChange={(id: string) => setLocation(getLocation(id) ?? locations[0])} />}
    >
      {hasPinned && (
        <List.Section title="Pinned">
          {pinnedItems.map((item) => (
            <PollenflugListItem key={item.name} item={item} day={day} setPinned={setPinned} daysSection={daysSection} />
          ))}
        </List.Section>
      )}
      <List.Section title={hasPinned ? "Other" : undefined}>
        {unpinnedItems.map((item) => (
          <PollenflugListItem key={item.name} item={item} day={day} setPinned={setPinned} daysSection={daysSection} />
        ))}
      </List.Section>
    </List>
  );
}

function PollenflugListItem({
  item,
  day,
  setPinned,
  daysSection,
}: {
  item: PollenflugItem;
  day: Day;
  setPinned: (pinned: string[]) => void;
  daysSection: JSX.Element;
}) {
  return (
    <List.Item
      key={item.name}
      title={item.name}
      accessories={[{ tag: getPollenDisplay(item[day]) }, {}]}
      actions={
        <ActionPanel>
          <Action
            title={`Pin ${item.name}`}
            icon={Icon.Pin}
            shortcut={{ modifiers: ["cmd"], key: "u" }}
            onAction={() => handlePin(item.name).then((pinned) => setPinned(pinned))}
          />
          {daysSection}
        </ActionPanel>
      }
    />
  );
}

function LocationDropdown({ onChange }: { onChange: (id: string) => void }) {
  return (
    <List.Dropdown tooltip="Select region" storeValue onChange={(newValue) => onChange(newValue)}>
      {locations.map((location) => (
        <List.Dropdown.Item
          key={location.partregion_id}
          value={`${location.region_id}:${location.partregion_id}`}
          title={`${location.partregion_name} (${location.region_name})`}
        />
      ))}
    </List.Dropdown>
  );
}
