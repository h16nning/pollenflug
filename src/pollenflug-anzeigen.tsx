import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useFetch } from "@raycast/utils";
import { useState } from "react";
import { handlePin, usePinned } from "./pin";

/* raw data as it is returned from DWD API */
type PollenflugApiData = {
  next_update: string;
  last_update: string;
  name: string; // "Pollenflug-Gefahrenindex für Deutschland ausgegeben vom Deutschen Wetterdienst"
  content: (Location & { Pollen: { [key: string]: Record<Day, string> } })[];
  sender: string; // "Deutscher Wetterdienst - Medizin-Meteorologie"
};

/* location-specific and cleaned up data */
export type Pollenflug = {
  location: Location;
  pollen: PollenflugItem[];
};

type Day = "today" | "tomorrow" | "dayafter_to";

const DayDict: Record<Day, string> = {
  today: "Heute",
  tomorrow: "Morgen",
  dayafter_to: "Übermorgen",
};

type PollenflugItem = {
  name: string;
} & Record<Day, string>;

type Location = {
  partregion_id: number;
  partregion_name: string;
  region_id: number;
  region_name: string;
};

/**
 * TODO: consider adding more readable labels
 */
const locations: Location[] = [
  {
    partregion_id: 11,
    partregion_name: "Inseln und Marschen",
    region_id: 10,
    region_name: "Schleswig-Holstein und Hamburg",
  },
  {
    partregion_id: 12,
    partregion_name: "Geest,Schleswig-Holstein und Hamburg",
    region_id: 10,
    region_name: "Schleswig-Holstein und Hamburg",
  },
  {
    partregion_id: -1,
    partregion_name: "",
    region_id: 20,
    region_name: "Mecklenburg-Vorpommern",
  },
  {
    partregion_id: 31,
    partregion_name: "Westl. Niedersachsen/Bremen",
    region_id: 30,
    region_name: "Niedersachsen und Bremen",
  },
  {
    partregion_id: 32,
    partregion_name: "Östl. Niedersachsen",
    region_id: 30,
    region_name: "Niedersachsen und Bremen",
  },
  {
    partregion_id: 41,
    partregion_name: "Rhein.-Westfäl. Tiefland",
    region_id: 40,
    region_name: "Nordrhein-Westfalen",
  },
  {
    partregion_id: 42,
    partregion_name: "Ostwestfalen",
    region_id: 40,
    region_name: "Nordrhein-Westfalen",
  },
  {
    partregion_id: 43,
    partregion_name: "Mittelgebirge NRW",
    region_id: 40,
    region_name: "Nordrhein-Westfalen",
  },
  {
    partregion_id: -1,
    partregion_name: "",
    region_id: 50,
    region_name: "Brandenburg und Berlin",
  },
  {
    partregion_id: 61,
    partregion_name: "Tiefland Sachsen-Anhalt",
    region_id: 60,
    region_name: "Sachsen-Anhalt",
  },
  {
    partregion_id: 62,
    partregion_name: "Harz",
    region_id: 60,
    region_name: "Sachsen-Anhalt",
  },
  {
    partregion_id: 71,
    partregion_name: "Tiefland Thüringen",
    region_id: 70,
    region_name: "Thüringen",
  },
  {
    partregion_id: 72,
    partregion_name: "Mittelgebirge Thüringen",
    region_id: 70,
    region_name: "Thüringen",
  },
  {
    partregion_id: 81,
    partregion_name: "Tiefland Sachsen",
    region_id: 80,
    region_name: "Sachsen",
  },
  {
    partregion_id: 82,
    partregion_name: "Mittelgebirge Sachsen",
    region_id: 80,
    region_name: "Sachsen",
  },
  {
    partregion_id: 91,
    partregion_name: "Nordhessen und hess. Mittelgebirge",
    region_id: 90,
    region_name: "Hessen",
  },
  {
    partregion_id: 92,
    partregion_name: "Rhein-Main",
    region_id: 90,
    region_name: "Hessen",
  },
  {
    partregion_id: 101,
    partregion_name: "Rhein, Pfalz, Nahe und Mosel",
    region_id: 100,
    region_name: "Rheinland-Pfalz und Saarland",
  },
  {
    partregion_id: 102,
    partregion_name: "Mittelgebirgsbereich Rheinland-Pfalz",
    region_id: 100,
    region_name: "Rheinland-Pfalz und Saarland",
  },
  {
    partregion_id: 103,
    partregion_name: "Saarland",
    region_id: 100,
    region_name: "Rheinland-Pfalz und Saarland",
  },
  {
    partregion_id: 111,
    partregion_name: "Oberrhein und unteres Neckartal",
    region_id: 110,
    region_name: "Baden-Württemberg",
  },
  {
    partregion_id: 112,
    partregion_name: "Hohenlohe/mittlerer Neckar/Oberschwaben",
    region_id: 110,
    region_name: "Baden-Württemberg",
  },
  {
    partregion_id: 113,
    partregion_name: "Mittelgebirge Baden-Württemberg",
    region_id: 110,
    region_name: "Baden-Württemberg",
  },
  {
    partregion_id: 121,
    partregion_name: "Allgäu/Oberbayern/Bay. Wald",
    region_id: 120,
    region_name: "Bayern",
  },
  {
    partregion_id: 122,
    partregion_name: "Donauniederungen",
    region_id: 120,
    region_name: "Bayern",
  },
  {
    partregion_id: 123,
    partregion_name: "Bayern nördl. der Donau, o. Bayr. Wald, o. Mainfranken",
    region_id: 120,
    region_name: "Bayern",
  },
  {
    partregion_id: 124,
    partregion_name: "Mainfranken",
    region_id: 120,
    region_name: "Bayern",
  },
];

/**
 * Tries to find the location by its id
 * @param id format "region_id:partregion_id"
 * @returns the location object or undefined
 */
function getLocation(id: string): Location | undefined {
  const [region_id, partregion_id] = id.split(":").map((id) => parseInt(id));
  return locations.find((location) => location.partregion_id === partregion_id && location.region_id === region_id);
}

/*const subregions: Location[] = [
  { value: "Oberrhein_und_unteres_Neckartal", label: "Oberrhein und unteres Neckartal", type: "subregion" },
  { value: "Östl_Niedersachsen", label: "Östliches Niedersachsen", type: "subregion" },
  { value: "Saarland", label: "Saarland", type: "subregion" },
  { value: "Brandenburg_und_Berlin", label: "Brandenburg und Berlin", type: "subregion" },
  { value: "Donauniederungen", label: "Donauniederungen", type: "subregion" },
  { value: "Mittelgebirge_Sachsen", label: "Mittelgebirge Sachsen", type: "subregion" },
  { value: "Rhein_Westfäl_Tiefland", label: "Rhein-Westfälisches Tiefland", type: "subregion" },
  { value: "Nordhessen_und_hess_Mittelgebirge", label: "Nordhessen und hessische Mittelgebirge", type: "subregion" },
  { value: "Mainfranken", label: "Mainfranken", type: "subregion" },
  { value: "Rhein_Main", label: "Rhein-Main", type: "subregion" },
  { value: "Harz", label: "Harz", type: "subregion" },
  { value: "Inseln_und_Marschen", label: "Inseln und Marschen", type: "subregion" },
  { value: "Rhein_Pfalz_Nahe_und_Mosel", label: "Rhein-Pfalz, Nahe und Mosel", type: "subregion" },
  { value: "Ostwestfalen", label: "Ostwestfalen", type: "subregion" },
  {
    value: "Hohenlohe_mittlerer_Neckar_Oberschwaben",
    label: "Hohenlohe, mittlerer Neckar, Oberschwaben",
    type: "subregion",
  },
  { value: "Mittelgebirge_Baden_Württemberg", label: "Mittelgebirge Baden-Württemberg", type: "subregion" },
  { value: "Mittelgebirge_NRW", label: "Mittelgebirge NRW", type: "subregion" },
  { value: "Mittelgebirge_Thüringen", label: "Mittelgebirge Thüringen", type: "subregion" },
  { value: "Mittelgebirgsbereich_Rheinland_Pfalz", label: "Mittelgebirgsbereich Rheinland-Pfalz", type: "subregion" },
  { value: "Westl_Niedersachsen_Bremen", label: "Westliches Niedersachsen und Bremen", type: "subregion" },
  { value: "Tiefland_Thüringen", label: "Tiefland Thüringen", type: "subregion" },
  {
    value: "Bayern_n_der_Donau_o_Bayr_Wald_o_Mainfranken",
    label: "Bayern nördlich der Donau, östlicher Bayerischer Wald, östliches Mainfranken",
    type: "subregion",
  },
  { value: "Tiefland_Sachsen", label: "Tiefland Sachsen", type: "subregion" },
  { value: "Tiefland_Sachsen_Anhalt", label: "Tiefland Sachsen-Anhalt", type: "subregion" },
  { value: "Allgäu_Oberbayern_Bay_Wald", label: "Allgäu, Oberbayern, Bayerischer Wald", type: "subregion" },
  { value: "Geest_Schleswig_Holstein_und_Hamburg", label: "Geest Schleswig-Holstein und Hamburg", type: "subregion" },
  { value: "Mecklenburg_Vorpommern", label: "Mecklenburg-Vorpommern", type: "subregion" },
];*/

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
