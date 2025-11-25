// 内置地图模板数据
export const builtInMapTemplates = [
  {
    id: 'map_1_5',
    name: '1.5楼层地图',
    description: '包含CNC加工中心、电梯、货梯等点位',
    data: {
      mapfileEntitys: [],
      graphTopologys: [
        {
          graph: {
            name: "示例地图",
            description: "演示用地图"
          },
          poses: [
            {
              name: "CNC工位1",
              x: -5,
              y: 0,
              yaw: 0,
              uid: 1001,
              parkable: false,
              dockable: false
            },
            {
              name: "CNC工位2",
              x: -3,
              y: 0,
              yaw: 0,
              uid: 1002,
              parkable: false,
              dockable: false
            },
            {
              name: "CNC工位3",
              x: -1,
              y: 0,
              yaw: 0,
              uid: 1003,
              parkable: false,
              dockable: false
            },
            {
              name: "装卸点A",
              x: 3,
              y: 2,
              yaw: -1.57,
              uid: 1004,
              parkable: true,
              dockable: false
            },
            {
              name: "装卸点B",
              x: 3,
              y: -2,
              yaw: -1.57,
              uid: 1005,
              parkable: true,
              dockable: false
            },
            {
              name: "电梯点位",
              x: 0,
              y: 5,
              yaw: -1.57,
              uid: 1006,
              parkable: false,
              dockable: true
            }
          ],
          paths: [
            {
              name: "路径1",
              sourceName: "CNC工位1",
              targetName: "CNC工位2",
              bidirectional: true,
              uid: 2001
            },
            {
              name: "路径2",
              sourceName: "CNC工位2",
              targetName: "CNC工位3",
              bidirectional: true,
              uid: 2002
            },
            {
              name: "路径3",
              sourceName: "CNC工位3",
              targetName: "装卸点A",
              bidirectional: true,
              uid: 2003
            },
            {
              name: "路径4",
              sourceName: "装卸点A",
              targetName: "装卸点B",
              bidirectional: true,
              uid: 2004
            },
            {
              name: "路径5",
              sourceName: "装卸点B",
              targetName: "电梯点位",
              bidirectional: true,
              uid: 2005
            }
          ]
        }
      ]
    }
  }
];
