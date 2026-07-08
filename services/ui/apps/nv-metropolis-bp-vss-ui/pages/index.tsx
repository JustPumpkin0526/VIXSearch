// SPDX-License-Identifier: MIT
import { GetServerSideProps } from 'next';
import Head from 'next/head';

import Home from '../components/Home';
import { APPLICATION_TITLE } from '../constants/constants';

// Server-side props with data fetching
// services/ui/apps/nv-metropolis-bp-vss-ui/pages/index.tsx

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const { getNemoAgentToolkitSSProps } = await import('@nemo-agent-toolkit/ui/server');

    const nemoProps = await getNemoAgentToolkitSSProps(context);

    return {
      props: {
        ...nemoProps.props,

        // 로그인 직후에는 전체 탭 데이터를 미리 가져오지 않음
        alertsData: null,
        searchData: null,
        dashboardData: null,
        mapData: null,
        videoManagementData: null,

        serverRenderTime: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);

    return {
      props: {
        alertsData: null,
        dashboardData: null,
        mapData: null,
        searchData: null,
        videoManagementData: null,
        serverRenderTime: new Date().toISOString(),
      },
    };
  }
};

// Props interface matching what getServerSideProps returns
interface HomePageProps {
  alertsData?: any;
  dashboardData?: any;
  mapData?: any;
  searchData?: any;
  videoManagementData?: any;
  serverRenderTime?: string;
}

export default function HomePage(props: HomePageProps) {
  // Pass all SSR props to Home component
  return (
    <>
      <Head>
        <title>{APPLICATION_TITLE}</title>
      </Head>
      <Home {...props} />
    </>
  );
}